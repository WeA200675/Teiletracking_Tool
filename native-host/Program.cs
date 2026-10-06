using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
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
var networkConfig = initial["network"]?.AsObject();
var httpsConfig = initial["https"]?.AsObject();
var port = networkConfig?["port"]?.GetValue<int>() ?? 8000;
var httpsPort = httpsConfig?["port"]?.GetValue<int>() ?? 8443;
var remoteRequested = networkConfig?["remoteAccessEnabled"]?.GetValue<bool>() ?? false;
var pfxPath = httpsConfig?["pfxPath"]?.GetValue<string>() ?? "";
var pfxPassword = Environment.GetEnvironmentVariable("TEILETRACKING_PFX_PASSWORD");
var remoteBindAddress = FindAddress(initial);
X509Certificate2? remoteCertificate = null;
if (remoteRequested && httpsConfig?["enabled"]?.GetValue<bool>() == true &&
    port != httpsPort && !string.IsNullOrWhiteSpace(remoteBindAddress) &&
    !string.IsNullOrWhiteSpace(pfxPath) && File.Exists(pfxPath) &&
    !string.IsNullOrEmpty(pfxPassword) && pfxPassword.Length >= 20)
{
    try
    {
        var candidate = X509CertificateLoader.LoadPkcs12FromFile(
            pfxPath, pfxPassword, X509KeyStorageFlags.EphemeralKeySet);
        if (candidate.HasPrivateKey && candidate.NotBefore <= DateTime.UtcNow &&
            candidate.NotAfter > DateTime.UtcNow)
            remoteCertificate = candidate;
        else
            candidate.Dispose();
    }
    catch (Exception ex)
    {
        Log("ERROR", "HTTPS-CONFIG-001", "Remote-Zugriff deaktiviert: Zertifikat konnte nicht sicher geladen werden (" + ex.GetType().Name + ").");
    }
}
var remoteAccessAvailable = remoteRequested && remoteCertificate is not null &&
    !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TEILETRACKING_ACCESS_PASSWORD")) &&
    Environment.GetEnvironmentVariable("TEILETRACKING_ACCESS_PASSWORD")!.Length >= 20;
if (remoteRequested && !remoteAccessAvailable)
    Log("ERROR", "REMOTE-ACCESS-001", "Remote-Zugriff bleibt gesperrt. Erforderlich sind ein gültiges HTTPS-Zertifikat, ein starkes TEILETRACKING_ACCESS_PASSWORD und eine passende Netzwerkschnittstelle.");

builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 1024 * 1024;
    k.Listen(IPAddress.Loopback, port);
    if (remoteAccessAvailable)
        k.Listen(IPAddress.Parse(remoteBindAddress!), httpsPort,
            options => options.UseHttps(remoteCertificate!));
});

builder.Services.AddSingleton(new RuntimeState());
builder.Services.AddHostedService<NetworkMonitor>();
builder.Services.AddHostedService<SyncWorker>();
var app = builder.Build();

var sessions = new ConcurrentDictionary<string, DateTimeOffset>(StringComparer.Ordinal);
var failedLogins = new ConcurrentDictionary<string, LoginAttemptState>(StringComparer.Ordinal);

bool IsSameOrigin(HttpContext context)
{
    var origin = context.Request.Headers.Origin.ToString();
    if (string.IsNullOrWhiteSpace(origin) ||
        !Uri.TryCreate(origin, UriKind.Absolute, out var parsed))
        return false;
    return parsed.Scheme.Equals(context.Request.Scheme, StringComparison.OrdinalIgnoreCase) &&
        parsed.Authority.Equals(context.Request.Host.Value, StringComparison.OrdinalIgnoreCase);
}
string SafeReturnPath(string? value)
{
    if (string.IsNullOrWhiteSpace(value) || !value.StartsWith('/') ||
        value.StartsWith("//", StringComparison.Ordinal) ||
        value.Contains('\\') || value.Contains('\r') || value.Contains('\n'))
        return "/prototype/";
    return value;
}
bool IsBoundedJson(JsonNode? node, int depth = 0)
{
    if (depth > 16) return false;
    if (node is JsonObject obj)
        return obj.Count <= 128 && obj.All(pair =>
            pair.Key.Length <= 128 && IsBoundedJson(pair.Value, depth + 1));
    if (node is JsonArray array)
        return array.Count <= 1000 && array.All(item => IsBoundedJson(item, depth + 1));
    if (node is JsonValue value)
    {
        try { return value.GetValue<string>().Length <= 8192; } catch { }
        try { _ = value.GetValue<double>(); return true; } catch { }
        try { _ = value.GetValue<bool>(); return true; } catch { }
        return false;
    }
    return true;
}

app.Use(async (ctx, next) =>
{
    var loopback = IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress ?? IPAddress.None);
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    ctx.Response.Headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()";
    ctx.Response.Headers["Content-Security-Policy"] = loopback
        ? "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:"
        : "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:";
    if (ctx.Request.IsHttps)
        ctx.Response.Headers["Strict-Transport-Security"] = "max-age=31536000";

    var unsafeMethod = HttpMethods.IsPost(ctx.Request.Method) ||
        HttpMethods.IsPut(ctx.Request.Method) || HttpMethods.IsPatch(ctx.Request.Method) ||
        HttpMethods.IsDelete(ctx.Request.Method);
    if (unsafeMethod && !IsSameOrigin(ctx))
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        await ctx.Response.WriteAsJsonAsync(new { error = "Cross-Origin-Anfrage abgelehnt." });
        return;
    }

    var isLoginPage = ctx.Request.Path.Equals("/login", StringComparison.OrdinalIgnoreCase);
    var isLoginPost = ctx.Request.Path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase);
    if (!loopback && (isLoginPage || isLoginPost))
    {
        await next();
        return;
    }

    if (!loopback)
    {
        var cookie = ctx.Request.Cookies["tt_session"];
        var authenticated = remoteAccessAvailable && cookie is not null &&
            sessions.TryGetValue(cookie, out var expiresAt) && expiresAt > DateTimeOffset.UtcNow;
        if (!authenticated)
        {
            if (cookie is not null) sessions.TryRemove(cookie, out _);
            if (HttpMethods.IsGet(ctx.Request.Method) &&
                ctx.Request.Headers.Accept.Any(value => value?.Contains("text/html", StringComparison.OrdinalIgnoreCase) == true))
            {
                var returnTo = Uri.EscapeDataString(SafeReturnPath(ctx.Request.Path + ctx.Request.QueryString));
                ctx.Response.Redirect("/login?returnTo=" + returnTo);
            }
            else
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsJsonAsync(new { error = "Anmeldung erforderlich." });
            }
            return;
        }
    }
    await next();
});

app.MapGet("/", () => Results.Redirect("/prototype/"));
app.MapGet("/login", (HttpContext ctx) =>
{
    ctx.Response.Headers["Cache-Control"] = "no-store";
    var returnTo = WebUtility.HtmlEncode(SafeReturnPath(ctx.Request.Query["returnTo"]));
    return Results.Content(LoginPage.Html.Replace("{{RETURN_TO}}", returnTo), "text/html; charset=utf-8");
});
app.MapPost("/api/auth/login", async (HttpContext ctx) =>
{
    if (!remoteAccessAvailable || (!ctx.Request.IsHttps &&
        !IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress ?? IPAddress.None)))
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    if (!ctx.Request.HasFormContentType || (ctx.Request.ContentLength ?? 0) > 16384)
        return Results.BadRequest(new { error = "Ungültige Anmeldedaten." });

    var ip = (ctx.Connection.RemoteIpAddress ?? IPAddress.None).ToString();
    var attempts = failedLogins.GetOrAdd(ip, _ => new LoginAttemptState());
    lock (attempts)
    {
        if (DateTimeOffset.UtcNow - attempts.WindowStarted > TimeSpan.FromMinutes(15))
        {
            attempts.WindowStarted = DateTimeOffset.UtcNow;
            attempts.Failures = 0;
        }
        if (attempts.Failures >= 5)
            return Results.StatusCode(StatusCodes.Status429TooManyRequests);
    }

    var form = await ctx.Request.ReadFormAsync(ctx.RequestAborted);
    var supplied = Encoding.UTF8.GetBytes(form["password"].ToString());
    var expected = Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("TEILETRACKING_ACCESS_PASSWORD") ?? "");
    if (expected.Length < 20 || !CryptographicOperations.FixedTimeEquals(supplied, expected))
    {
        lock (attempts) attempts.Failures++;
        return Results.Content(LoginPage.FailureHtml.Replace("{{RETURN_TO}}",
            WebUtility.HtmlEncode(SafeReturnPath(form["returnTo"]))), "text/html; charset=utf-8",
            statusCode: StatusCodes.Status401Unauthorized);
    }

    lock (attempts) attempts.Failures = 0;
    var sessionId = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    sessions[sessionId] = DateTimeOffset.UtcNow.AddHours(8);
    ctx.Response.Cookies.Append("tt_session", sessionId, new CookieOptions
    {
        HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict,
        IsEssential = true, Path = "/", MaxAge = TimeSpan.FromHours(8)
    });
    return Results.Redirect(SafeReturnPath(form["returnTo"]));
});
app.MapPost("/api/auth/logout", (HttpContext ctx) =>
{
    if (ctx.Request.Cookies.TryGetValue("tt_session", out var cookie) && cookie is not null)
        sessions.TryRemove(cookie, out _);
    ctx.Response.Cookies.Delete("tt_session", new CookieOptions
    {
        HttpOnly = true, Secure = !IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress ?? IPAddress.None),
        SameSite = SameSiteMode.Strict, Path = "/"
    });
    return Results.Redirect("/login");
});
app.MapGet("/health", (RuntimeState state) => Results.Ok(new { status = "ok", version = "0.4.1", startedAt = state.StartedAt }));
app.MapGet("/api/status", (RuntimeState state) =>
{
    var cfg = LoadConfig();
    var ip = FindAddress(cfg);
    var q = QueueStore.Load(queuePath);
    var currentPort = cfg["network"]?["port"]?.GetValue<int>() ?? 8000;
    return Results.Ok(new {
        version = "0.4.1",
        setupCompleted = cfg["setupCompleted"]?.GetValue<bool>() ?? false,
        remoteAccessEnabled = remoteAccessAvailable,
        activeIp = ip,
        port = remoteAccessAvailable ? httpsPort : currentPort,
        url = remoteAccessAvailable && ip is not null ? $"https://{ip}:{httpsPort}/prototype/" : null,
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
    if (!IPAddress.IsLoopback(c.Connection.RemoteIpAddress ?? IPAddress.None))
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    JsonObject? cfg;
    try
    {
        cfg = await JsonNode.ParseAsync(c.Request.Body,
            documentOptions: new JsonDocumentOptions { MaxDepth = 16 },
            cancellationToken: c.RequestAborted) as JsonObject;
    }
    catch (JsonException)
    {
        return Results.BadRequest(new { error = "Ungültiges JSON." });
    }
    if (cfg is null || !IsBoundedJson(cfg))
        return Results.BadRequest(new { error = "Ungültige Konfiguration." });
    var network = cfg["network"] as JsonObject;
    var https = cfg["https"] as JsonObject;
    var configuredPort = network?["port"]?.GetValue<int>() ?? 0;
    var configuredHttpsPort = https?["port"]?.GetValue<int>() ?? 0;
    if (configuredPort is < 1024 or > 65535 ||
        configuredHttpsPort is < 1024 or > 65535 ||
        configuredPort == configuredHttpsPort)
        return Results.BadRequest(new { error = "HTTP- und HTTPS-Port müssen verschieden und zwischen 1024 und 65535 sein." });
    if ((network?["remoteAccessEnabled"]?.GetValue<bool>() ?? false) &&
        !(https?["enabled"]?.GetValue<bool>() ?? false))
        return Results.BadRequest(new { error = "Remote-Zugriff erfordert HTTPS." });

    cfg["setupCompleted"] = true;
    SaveConfig(cfg);
    Log("INFO", "CONFIG-001", "Konfiguration gespeichert. Änderungen werden nach Neustart aktiv.");
    return Results.Ok(new { saved = true, restartRequired = true });
});
app.MapPost("/api/sharepoint/test", async () =>
{
    var cfg = LoadConfig();
    var sp = cfg["sharePoint"]!.AsObject();
    var mode = sp["mode"]?.GetValue<string>() ?? "DISABLED";
    var site = sp["siteUrl"]?.GetValue<string>() ?? "";
    if (mode == "DISABLED") return Results.Ok(new { reachable = false, code = "SP-DISABLED", message = "SharePoint ist deaktiviert." });
    if (!Uri.TryCreate(site, UriKind.Absolute, out var uri) ||
        uri.Scheme != Uri.UriSchemeHttps || !uri.IsDefaultPort ||
        !string.IsNullOrEmpty(uri.UserInfo) || IPAddress.TryParse(uri.Host, out _))
        return Results.BadRequest(new { reachable = false, code = "SP-CONFIG-001", message = "Zulässig ist nur eine HTTPS-Site ohne Zugangsdaten in der URL." });

    var allowedHosts = (Environment.GetEnvironmentVariable("TEILETRACKING_SHAREPOINT_ALLOWED_HOSTS") ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    if (allowedHosts.Count == 0 || !allowedHosts.Contains(uri.IdnHost))
        return Results.StatusCode(StatusCodes.Status403Forbidden);

    try
    {
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(10) };
        using var req = new HttpRequestMessage(HttpMethod.Head, uri);
        var res = await client.SendAsync(req);
        var reachable = (int)res.StatusCode < 500;
        return Results.Ok(new { reachable, httpStatus = (int)res.StatusCode, code = reachable ? "SP-NET-OK" : "SP-NET-003", authenticationRequired = res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden });
    }
    catch (Exception ex)
    {
        Log("ERROR", "SP-NET-003", "SharePoint-Erreichbarkeit fehlgeschlagen (" + ex.GetType().Name + ").");
        return Results.Ok(new { reachable = false, code = "SP-NET-003", message = "Erreichbarkeit fehlgeschlagen." });
    }
});
app.MapPost("/api/queue", async (HttpContext c) =>
{
    if (!c.Request.HasJsonContentType)
        return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
    JsonNode? data;
    try
    {
        data = await JsonNode.ParseAsync(c.Request.Body,
            documentOptions: new JsonDocumentOptions { MaxDepth = 16 },
            cancellationToken: c.RequestAborted);
    }
    catch (JsonException)
    {
        return Results.BadRequest(new { error = "Ungültiges JSON." });
    }
    if (data is not JsonObject || !IsBoundedJson(data))
        return Results.BadRequest(new { error = "Datensatzformat oder -größe ist unzulässig." });

    string id;
    if (data["RecordId"] is JsonNode idNode)
    {
        if (idNode is not JsonValue idValue || !idValue.TryGetValue<string>(out var suppliedId) ||
            string.IsNullOrWhiteSpace(suppliedId) || suppliedId.Length > 128)
            return Results.BadRequest(new { error = "RecordId ist ungültig." });
        id = suppliedId;
    }
    else
    {
        id = Guid.NewGuid().ToString("D");
    }

    var q = QueueStore.Load(queuePath);
    if (q.Count >= 10000)
        return Results.StatusCode(StatusCodes.Status429TooManyRequests);
    if (q.Any(x => x.RecordId == id))
        return Results.Conflict(new { code = "SYNC-DUPLICATE-001", recordId = id });
    q.Add(new QueueItem(id, "PENDING", 0, DateTimeOffset.UtcNow, null, data));
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

sealed class LoginAttemptState
{
    public DateTimeOffset WindowStarted { get; set; } = DateTimeOffset.UtcNow;
    public int Failures { get; set; }
}
static class LoginPage
{
    public const string Html = """
<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teiletracking Anmeldung</title>
<style>body{font:16px Segoe UI,Arial,sans-serif;background:#f4f6f8;color:#17212b;margin:0}main{max-width:420px;margin:12vh auto;padding:24px;background:white;border:1px solid #d6dce2;border-radius:12px}label{display:block;margin:18px 0 6px}input{box-sizing:border-box;width:100%;padding:12px;font:inherit}button{margin-top:18px;padding:11px 16px;background:#164b70;color:white;border:0;border-radius:6px;font:inherit}p{line-height:1.5}</style></head>
<body><main><h1>Teiletracking</h1><p>Für den Netzwerkzugriff ist die Anmeldung erforderlich.</p>
<form method="post" action="/api/auth/login"><input type="hidden" name="returnTo" value="{{RETURN_TO}}">
<label for="password">Zugriffspasswort</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="20" maxlength="256">
<button type="submit">Anmelden</button></form></main></body></html>
""";
    public const string FailureHtml = """
<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anmeldung fehlgeschlagen</title></head>
<body><main><h1>Anmeldung fehlgeschlagen</h1><p>Prüfe das Zugriffspasswort und versuche es erneut.</p><a href="/login?returnTo={{RETURN_TO}}">Zur Anmeldung</a></main></body></html>
""";
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
<label><input id="remoteEnabled" type="checkbox" style="width:auto"> Zugriff aus dem ausgewählten Netz aktivieren</label>
<small>Standard ist nur Zugriff auf diesem PC. Netzwerkzugriff wird nur mit HTTPS-Zertifikat und TEILETRACKING_ACCESS_PASSWORD (mindestens 20 Zeichen) geöffnet.</small></div>
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
async function load(){cfg=await (await fetch('/api/config')).json();netMode.value=cfg.network.mode;cidr.value=cfg.network.preferredNetwork;iface.value=cfg.network.preferredInterface;port.value=cfg.network.port;remoteEnabled.checked=cfg.network.remoteAccessEnabled===true;httpsEnabled.checked=cfg.https.enabled;httpsPort.value=cfg.https.port;pfx.value=cfg.https.pfxPath;spMode.value=cfg.sharePoint.mode;site.value=cfg.sharePoint.siteUrl;client.value=cfg.sharePoint.clientId;await loadStatus();const xs=await(await fetch('/api/interfaces')).json();interfaces.innerHTML=xs.map(x=>'<div><b>'+esc(x.name)+'</b>: '+esc(x.address)+'/'+x.prefixLength+'</div>').join('')}
async function loadStatus(){const s=await(await fetch('/api/status')).json();status.innerHTML='<div class="grid"><div><b>Version</b><br>'+esc(s.version)+'</div><div><b>Aktive IP</b><br>'+esc(s.activeIp||'keine')+'</div><div><b>Port</b><br>'+s.port+'</div><div><b>Queue</b><br>'+s.pending+' ausstehend / '+s.errors+' Fehler</div></div>'}
async function save(){cfg.network.mode=netMode.value;cfg.network.preferredNetwork=cidr.value.trim();cfg.network.preferredInterface=iface.value.trim();cfg.network.port=+port.value;cfg.network.remoteAccessEnabled=remoteEnabled.checked;cfg.https.enabled=httpsEnabled.checked;cfg.https.port=+httpsPort.value;cfg.https.pfxPath=pfx.value.trim();cfg.sharePoint.mode=spMode.value;cfg.sharePoint.siteUrl=site.value.trim();cfg.sharePoint.clientId=client.value.trim();result.textContent=JSON.stringify(await(await fetch('/api/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(cfg)})).json(),null,2)}
async function testSp(){spResult.textContent=JSON.stringify(await(await fetch('/api/sharepoint/test',{method:'POST'})).json(),null,2)}
async function exportQueue(){result.textContent=JSON.stringify(await(await fetch('/api/sync/export',{method:'POST'})).json(),null,2)}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}load();
</script></body></html>
""";
}
