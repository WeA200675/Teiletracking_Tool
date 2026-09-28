using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var root = AppContext.BaseDirectory;
var stateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Teiletracking");
Directory.CreateDirectory(stateDir);
var configPath = Path.Combine(stateDir, "config.json");
var queuePath = Path.Combine(stateDir, "sync-queue.json");
var logPath = Path.Combine(stateDir, "teiletracking.log");
var fallbackDir = Path.Combine(stateDir, "fallback");
Directory.CreateDirectory(fallbackDir);

JsonObject LoadConfig()
{
    if (!File.Exists(configPath))
    {
        var source = Path.Combine(root, "appsettings.default.json");
        File.Copy(source, configPath, true);
    }
    return JsonNode.Parse(File.ReadAllText(configPath))!.AsObject();
}
void SaveConfig(JsonObject cfg) => File.WriteAllText(configPath, cfg.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
void Log(string level, string code, string message)
{
    var line = $"{DateTimeOffset.Now:O}\t{level}\t{code}\t{message.Replace(Environment.NewLine, " ")}";
    File.AppendAllText(logPath, line + Environment.NewLine);
}
string? FindAddress(JsonObject cfg)
{
    var network = cfg["network"]!.AsObject();
    var mode = network["mode"]?.GetValue<string>() ?? "AUTO";
    var cidr = network["preferredNetwork"]?.GetValue<string>() ?? "";
    var preferred = network["preferredInterface"]?.GetValue<string>() ?? "";
    var candidates = NetworkInterface.GetAllNetworkInterfaces()
        .Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
        .SelectMany(n => n.GetIPProperties().UnicastAddresses
            .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
            .Select(a => new { Interface = n.Name, Address = a.Address.ToString(), Prefix = a.PrefixLength }))
        .ToList();
    if (!string.IsNullOrWhiteSpace(preferred))
        candidates = candidates.OrderByDescending(x => x.Interface.Equals(preferred, StringComparison.OrdinalIgnoreCase)).ToList();
    return candidates.FirstOrDefault(x => mode.Equals("AUTO", StringComparison.OrdinalIgnoreCase) || InCidr(x.Address, cidr))?.Address;
}
bool InCidr(string address, string cidr)
{
    try
    {
        var p = cidr.Split('/');
        if (p.Length != 2) return false;
        var prefix = int.Parse(p[1]);
        if (prefix < 0 || prefix > 32) return false;
        var a = BitConverter.ToUInt32(IPAddress.Parse(address).GetAddressBytes().Reverse().ToArray());
        var n = BitConverter.ToUInt32(IPAddress.Parse(p[0]).GetAddressBytes().Reverse().ToArray());
        var mask = prefix == 0 ? 0u : uint.MaxValue << (32 - prefix);
        return (a & mask) == (n & mask);
    }
    catch { return false; }
}
object Interfaces() => NetworkInterface.GetAllNetworkInterfaces()
    .Where(n => n.OperationalStatus == OperationalStatus.Up)
    .SelectMany(n => n.GetIPProperties().UnicastAddresses
        .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
        .Select(a => new { name = n.Name, description = n.Description, address = a.Address.ToString(), prefixLength = a.PrefixLength }))
    .ToArray();

var initial = LoadConfig();
var port = initial["network"]?["port"]?.GetValue<int>() ?? 8000;
builder.WebHost.ConfigureKestrel(k =>
{
    k.ListenAnyIP(port);
    var https = initial["https"]?.AsObject();
    if (https?["enabled"]?.GetValue<bool>() == true)
    {
        var httpsPort = https["port"]?.GetValue<int>() ?? 8443;
        var pfx = https["pfxPath"]?.GetValue<string>() ?? "";
        var envName = https["pfxPasswordEnvironmentVariable"]?.GetValue<string>() ?? "TEILETRACKING_PFX_PASSWORD";
        var password = Environment.GetEnvironmentVariable(envName);
        if (!string.IsNullOrWhiteSpace(pfx) && File.Exists(pfx) && !string.IsNullOrEmpty(password))
            k.ListenAnyIP(httpsPort, o => o.UseHttps(pfx, password));
        else
            Log("ERROR", "HTTPS-CONFIG-001", "HTTPS ist aktiviert, aber Zertifikat oder Passwort fehlt.");
    }
});

builder.Services.AddSingleton(new RuntimeState());
builder.Services.AddHostedService<NetworkMonitor>();
builder.Services.AddHostedService<SyncWorker>();
var app = builder.Build();

app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

app.MapGet("/", () => Results.Redirect("/prototype/"));
app.MapGet("/health", (RuntimeState state) => Results.Ok(new { status = "ok", version = "0.4.0", startedAt = state.StartedAt }));
app.MapGet("/api/status", (RuntimeState state) =>
{
    var cfg = LoadConfig();
    var ip = FindAddress(cfg);
    var q = QueueStore.Load(queuePath);
    return Results.Ok(new {
        version = "0.4.0",
        setupCompleted = cfg["setupCompleted"]?.GetValue<bool>() ?? false,
        activeIp = ip,
        port = cfg["network"]?["port"]?.GetValue<int>() ?? 8000,
        url = ip is null ? null : $"http://{ip}:{port}/prototype/",
        sharePointMode = cfg["sharePoint"]?["mode"]?.GetValue<string>() ?? "DISABLED",
        pending = q.Count(x => x.Status is "PENDING" or "RETRY_WAIT"),
        errors = q.Count(x => x.Status is "ERROR" or "CONFLICT"),
        synced = q.Count(x => x.Status == "SYNCED"),
        lastNetworkChange = state.LastNetworkChange
    });
});
app.MapGet("/api/interfaces", () => Results.Ok(Interfaces()));
app.MapGet("/api/config", (HttpContext c) =>
{
    if (!IPAddress.IsLoopback(c.Connection.RemoteIpAddress ?? IPAddress.None)) return Results.StatusCode(403);
    var cfg = LoadConfig();
    if (cfg["https"] is JsonObject h) h["pfxPasswordEnvironmentVariable"] = h["pfxPasswordEnvironmentVariable"]?.GetValue<string>() ?? "TEILETRACKING_PFX_PASSWORD";
    return Results.Ok(cfg);
});
app.MapPut("/api/config", async (HttpContext c) =>
{
    if (!IPAddress.IsLoopback(c.Connection.RemoteIpAddress ?? IPAddress.None)) return Results.StatusCode(403);
    var cfg = await JsonNode.ParseAsync(c.Request.Body) as JsonObject;
    if (cfg is null) return Results.BadRequest(new { error = "Ungültige Konfiguration." });
    cfg["setupCompleted"] = true;
    SaveConfig(cfg);
    Log("INFO", "CONFIG-001", "Konfiguration gespeichert. Port-/HTTPS-Änderungen werden nach Neustart aktiv.");
    return Results.Ok(new { saved = true, restartRequired = true });
});
app.MapPost("/api/sharepoint/test", async () =>
{
    var cfg = LoadConfig();
    var sp = cfg["sharePoint"]!.AsObject();
    var mode = sp["mode"]?.GetValue<string>() ?? "DISABLED";
    var site = sp["siteUrl"]?.GetValue<string>() ?? "";
    if (mode == "DISABLED") return Results.Ok(new { reachable = false, code = "SP-DISABLED", message = "SharePoint ist deaktiviert." });
    if (!Uri.TryCreate(site, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
        return Results.BadRequest(new { reachable = false, code = "SP-CONFIG-001", message = "SharePoint SiteUrl fehlt oder ist ungültig." });
    try
    {
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(15) };
        using var req = new HttpRequestMessage(HttpMethod.Head, uri);
        var res = await client.SendAsync(req);
        var reachable = (int)res.StatusCode < 500;
        return Results.Ok(new { reachable, httpStatus = (int)res.StatusCode, code = reachable ? "SP-NET-OK" : "SP-NET-003", authenticationRequired = res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden });
    }
    catch (Exception ex)
    {
        Log("ERROR", "SP-NET-003", ex.Message);
        return Results.Ok(new { reachable = false, code = "SP-NET-003", message = ex.Message });
    }
});
app.MapPost("/api/queue", async (HttpContext c) =>
{
    var data = await JsonNode.ParseAsync(c.Request.Body);
    if (data is null) return Results.BadRequest();
    var id = data["RecordId"]?.GetValue<string>() ?? Guid.NewGuid().ToString();
    var q = QueueStore.Load(queuePath);
    if (q.Any(x => x.RecordId == id)) return Results.Conflict(new { code = "SYNC-DUPLICATE-001", recordId = id });
    q.Add(new QueueItem(id, "PENDING", 0, DateTimeOffset.Now, null, data));
    QueueStore.Save(queuePath, q);
    return Results.Accepted(value: new { recordId = id, status = "PENDING" });
});
app.MapPost("/api/sync/export", () =>
{
    var q = QueueStore.Load(queuePath).Where(x => x.Status is "PENDING" or "RETRY_WAIT" or "ERROR").ToList();
    if (q.Count == 0) return Results.Ok(new { exported = 0 });
    var batch = Guid.NewGuid().ToString();
    var payload = JsonSerializer.SerializeToUtf8Bytes(new { formatVersion = 1, batchId = batch, exportedAt = DateTimeOffset.Now, records = q });
    var hash = Convert.ToHexString(SHA256.HashData(payload));
    var package = new { formatVersion = 1, batchId = batch, sha256 = hash, payload = Convert.ToBase64String(payload) };
    var path = Path.Combine(fallbackDir, $"teiletracking-{DateTime.Now:yyyyMMdd-HHmmss}-{batch}.json");
    File.WriteAllText(path, JsonSerializer.Serialize(package, new JsonSerializerOptions { WriteIndented = true }));
    foreach (var item in q) item.Status = "EXPORTED";
    QueueStore.Save(queuePath, QueueStore.Load(queuePath).Select(x => q.FirstOrDefault(y => y.RecordId == x.RecordId) ?? x).ToList());
    Log("INFO", "SYNC-EXPORT-001", $"{q.Count} Datensätze exportiert: {path}");
    return Results.Ok(new { exported = q.Count, path, sha256 = hash });
});
app.MapGet("/control-center", (HttpContext c) =>
{
    if (!IPAddress.IsLoopback(c.Connection.RemoteIpAddress ?? IPAddress.None)) return Results.StatusCode(403);
    return Results.Content(ControlCenter.Html, "text/html; charset=utf-8");
});

var appDir = Path.Combine(root, "app");
if (Directory.Exists(appDir))
{
    app.UseStaticFiles(new StaticFileOptions {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(appDir),
        RequestPath = ""
    });
}

try
{
    var cfg = LoadConfig();
    var ip = FindAddress(cfg);
    Log("INFO", "APP-START-001", $"Teiletracking 0.4.0 gestartet; IP={ip ?? "keine"}; Port={port}");
    var url = "http://127.0.0.1:" + port + ((cfg["setupCompleted"]?.GetValue<bool>() ?? false) ? "/control-center" : "/control-center");
    try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
    await app.RunAsync();
}
catch (Exception ex)
{
    Log("ERROR", "APP-HEALTH-001", ex.ToString());
    throw;
}

sealed class RuntimeState
{
    public DateTimeOffset StartedAt { get; } = DateTimeOffset.Now;
    public DateTimeOffset? LastNetworkChange { get; set; }
    public string? LastIp { get; set; }
}
sealed class NetworkMonitor(RuntimeState state, ILogger<NetworkMonitor> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            try
            {
                var addresses = NetworkInterface.GetAllNetworkInterfaces()
                    .Where(n => n.OperationalStatus == OperationalStatus.Up)
                    .SelectMany(n => n.GetIPProperties().UnicastAddresses)
                    .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
                    .Select(a => a.Address.ToString()).Order().ToArray();
                var signature = string.Join("|", addresses);
                if (state.LastIp != signature) { state.LastIp = signature; state.LastNetworkChange = DateTimeOffset.Now; }
            }
            catch (Exception ex) { log.LogWarning(ex, "NET-IP-001"); }
            await Task.Delay(TimeSpan.FromSeconds(10), stop);
        }
    }
}
sealed class SyncWorker(ILogger<SyncWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            // Direkte M365-Schreibzugriffe bleiben absichtlich aus, bis eine vom Tenant
            // freigegebene Authentifizierung (Client-ID/Consent) vorhanden ist.
            await Task.Delay(TimeSpan.FromSeconds(60), stop);
        }
    }
}
sealed class QueueItem
{
    public string RecordId { get; set; }
    public string Status { get; set; }
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? LastError { get; set; }
    public JsonNode Data { get; set; }

    public QueueItem(string recordId, string status, int attempts, DateTimeOffset createdAt, string? lastError, JsonNode data)
    {
        RecordId = recordId;
        Status = status;
        Attempts = attempts;
        CreatedAt = createdAt;
        LastError = lastError;
        Data = data;
    }
}
static class QueueStore
{
    static readonly object Gate = new();
    public static List<QueueItem> Load(string path)
    {
        lock (Gate)
        {
            if (!File.Exists(path)) return [];
            try { return JsonSerializer.Deserialize<List<QueueItem>>(File.ReadAllText(path)) ?? []; }
            catch { return []; }
        }
    }
    public static void Save(string path, List<QueueItem> items)
    {
        lock (Gate)
        {
            var temp = path + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(items, new JsonSerializerOptions { WriteIndented = true }));
            File.Move(temp, path, true);
        }
    }
}
static class ControlCenter
{
public const string Html = """
<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teiletracking Control Center</title><style>
body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f5f6f8;color:#1b1b1b}main{max-width:980px;margin:auto;padding:24px}
.card{background:white;border:1px solid #ddd;border-radius:10px;padding:18px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
label{display:block;font-weight:600;margin-top:10px}input,select{box-sizing:border-box;width:100%;padding:9px;margin-top:4px}
button,a.btn{display:inline-block;padding:9px 14px;margin:8px 6px 0 0;border:0;border-radius:6px;background:#222;color:white;text-decoration:none;cursor:pointer}
small{color:#555}.ok{color:#167c35}.warn{color:#9a5b00}pre{white-space:pre-wrap}
</style></head><body><main><h1>Teiletracking – Setup & Control Center</h1>
<div class="card"><h2>Status</h2><div id="status">Lade…</div><button onclick="loadStatus()">Aktualisieren</button><a class="btn" href="/prototype/">Tracking öffnen</a></div>
<div class="card"><h2>Netzwerk</h2><div id="interfaces"></div>
<label>Modus<select id="netMode"><option>MANUAL_RANGE</option><option>AUTO</option></select></label>
<label>Netzwerk des Tracking-PCs (CIDR)<input id="cidr" placeholder="10.138.24.0/24"></label>
<label>Bevorzugte Schnittstelle<input id="iface" placeholder="z. B. bmw"></label>
<label>HTTP-Port<input id="port" type="number"></label>
<small>Das Programm ändert keine Windows-Netzwerkeinstellungen. Portänderungen werden nach Neustart aktiv.</small></div>
<div class="card"><h2>HTTPS für Smartphone-Kamera</h2>
<label><input id="httpsEnabled" type="checkbox" style="width:auto"> HTTPS aktivieren</label>
<label>HTTPS-Port<input id="httpsPort" type="number"></label>
<label>PFX-Zertifikatspfad<input id="pfx" placeholder="C:\Zertifikate\teiletracking.pfx"></label>
<small>Das Zertifikat muss auf den Smartphones als vertrauenswürdig gelten. Das Passwort wird nicht gespeichert; es kommt aus TEILETRACKING_PFX_PASSWORD.</small></div>
<div class="card"><h2>SharePoint</h2>
<label>Modus<select id="spMode"><option>DISABLED</option><option>MANUAL</option><option>PACKAGE</option><option>AUTO_FALLBACK</option></select></label>
<label>Site URL<input id="site"></label><label>Client-ID (optional)<input id="client"></label>
<button onclick="testSp()">Erreichbarkeit testen</button><pre id="spResult"></pre>
<small>Der Test prüft Netzwerk/HTTP. Eine erfolgreiche Anmeldung wird erst möglich, wenn der Tenant eine Authentifizierung freigibt.</small></div>
<div class="card"><button onclick="save()">Konfiguration speichern</button><button onclick="exportQueue()">Fallback-Paket exportieren</button><pre id="result"></pre></div>
</main><script>
let cfg;
async function load(){cfg=await (await fetch('/api/config')).json();netMode.value=cfg.network.mode;cidr.value=cfg.network.preferredNetwork;iface.value=cfg.network.preferredInterface;port.value=cfg.network.port;httpsEnabled.checked=cfg.https.enabled;httpsPort.value=cfg.https.port;pfx.value=cfg.https.pfxPath;spMode.value=cfg.sharePoint.mode;site.value=cfg.sharePoint.siteUrl;client.value=cfg.sharePoint.clientId;await loadStatus();const xs=await(await fetch('/api/interfaces')).json();interfaces.innerHTML=xs.map(x=>'<div><b>'+esc(x.name)+'</b>: '+esc(x.address)+'/'+x.prefixLength+'</div>').join('')}
async function loadStatus(){const s=await(await fetch('/api/status')).json();status.innerHTML='<div class="grid"><div><b>Version</b><br>'+esc(s.version)+'</div><div><b>Aktive IP</b><br>'+esc(s.activeIp||'keine')+'</div><div><b>Port</b><br>'+s.port+'</div><div><b>Queue</b><br>'+s.pending+' ausstehend / '+s.errors+' Fehler</div></div>'}
async function save(){cfg.network.mode=netMode.value;cfg.network.preferredNetwork=cidr.value.trim();cfg.network.preferredInterface=iface.value.trim();cfg.network.port=+port.value;cfg.https.enabled=httpsEnabled.checked;cfg.https.port=+httpsPort.value;cfg.https.pfxPath=pfx.value.trim();cfg.sharePoint.mode=spMode.value;cfg.sharePoint.siteUrl=site.value.trim();cfg.sharePoint.clientId=client.value.trim();result.textContent=JSON.stringify(await(await fetch('/api/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(cfg)})).json(),null,2)}
async function testSp(){spResult.textContent=JSON.stringify(await(await fetch('/api/sharepoint/test',{method:'POST'})).json(),null,2)}
async function exportQueue(){result.textContent=JSON.stringify(await(await fetch('/api/sync/export',{method:'POST'})).json(),null,2)}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}load();
</script></body></html>
""";
}
