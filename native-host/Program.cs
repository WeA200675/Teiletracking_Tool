using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;
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
    var config = JsonNode.Parse(File.ReadAllText(configPath))!.AsObject();
    if (config["network"] is JsonObject network) network["remoteAccessEnabled"] = false;
    return config;
}
void SaveConfig(JsonObject cfg)
{
    if (cfg["network"] is JsonObject network) network["remoteAccessEnabled"] = false;
    cfg.Remove("sharePoint");
    File.WriteAllText(configPath, cfg.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
}
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
var remoteRequested = false;
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
    k.Limits.MaxRequestBodySize = 24 * 1024 * 1024;
    k.Listen(IPAddress.Loopback, port);
    if (remoteAccessAvailable)
        k.Listen(IPAddress.Parse(remoteBindAddress!), httpsPort,
            options => options.UseHttps(remoteCertificate!));
});

builder.Services.AddSingleton(new RuntimeState());
builder.Services.AddSingleton(new DatabaseStore(Path.Combine(stateDir, "teiletracking.db")));
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
    foreach (var stale in failedLogins.Where(entry =>
        DateTimeOffset.UtcNow - entry.Value.WindowStarted > TimeSpan.FromMinutes(15))
        .Select(entry => entry.Key).ToArray())
        failedLogins.TryRemove(stale, out _);
    if (!failedLogins.ContainsKey(ip) && failedLogins.Count >= 10000)
        return Results.StatusCode(StatusCodes.Status429TooManyRequests);
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
    foreach (var expired in sessions.Where(entry => entry.Value <= DateTimeOffset.UtcNow)
        .Select(entry => entry.Key).ToArray())
        sessions.TryRemove(expired, out _);
    if (sessions.Count >= 10000)
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
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
app.MapGet("/health", (RuntimeState state) => Results.Ok(new { status = "ok", version = "0.5.0", startedAt = state.StartedAt }));
app.MapGet("/api/status", (RuntimeState state, DatabaseStore database) =>
{
    var cfg = LoadConfig();
    var ip = FindAddress(cfg);
    var q = QueueStore.Load(queuePath);
    var currentPort = cfg["network"]?["port"]?.GetValue<int>() ?? 8000;
    return Results.Ok(new {
        version = "0.5.0",
        setupCompleted = cfg["setupCompleted"]?.GetValue<bool>() ?? false,
        remoteAccessEnabled = remoteAccessAvailable,
        activeIp = ip,
        port = remoteAccessAvailable ? httpsPort : currentPort,
        url = remoteAccessAvailable && ip is not null ? $"https://{ip}:{httpsPort}/prototype/" : null,
        storage = "SQLITE",
        trackingRecords = database.TrackingCount,
        databaseRevision = database.Revision,
        pending = q.Count(x => x.Status is "PENDING" or "RETRY_WAIT"),
        errors = q.Count(x => x.Status is "ERROR" or "CONFLICT"),
        synced = q.Count(x => x.Status == "SYNCED"),
        lastNetworkChange = state.LastNetworkChange
    });
});
app.MapGet("/api/database/master-data", (DatabaseStore database) =>
    Results.Json(database.LoadMasterData()));
app.MapPut("/api/database/master-data", async (HttpContext c, DatabaseStore database) =>
{
    JsonNode? data;
    try { data = await JsonNode.ParseAsync(c.Request.Body, documentOptions: new JsonDocumentOptions { MaxDepth = 16 }, cancellationToken: c.RequestAborted); }
    catch (JsonException) { return Results.BadRequest(new { error = "Ungültiges JSON." }); }
    if (data is not JsonObject || !IsBoundedJson(data))
        return Results.BadRequest(new { error = "Stammdatenformat oder -größe ist unzulässig." });
    var revision = database.SaveMasterData(data);
    return Results.Ok(new { saved = true, revision });
});
app.MapGet("/api/database/tracking", (DatabaseStore database) =>
{
    var snapshot = database.LoadTrackingSnapshot();
    return Results.Json(new { records = snapshot.Records, revision = snapshot.Revision });
});
app.MapPut("/api/database/tracking", async (HttpContext c, DatabaseStore database) =>
{
    JsonNode? data;
    try { data = await JsonNode.ParseAsync(c.Request.Body, documentOptions: new JsonDocumentOptions { MaxDepth = 16 }, cancellationToken: c.RequestAborted); }
    catch (JsonException) { return Results.BadRequest(new { error = "Ungültiges JSON." }); }
    if (data is not JsonObject obj || obj["records"] is not JsonArray records ||
        records.Count > 1000 || !IsBoundedJson(data))
        return Results.BadRequest(new { error = "Datensatzformat oder -größe ist unzulässig." });
    if (obj["revision"] is not JsonValue revisionNode || !revisionNode.TryGetValue<long>(out var expectedRevision))
        return Results.BadRequest(new { error = "Datenbankrevision fehlt oder ist ungültig." });
    try
    {
        if (!database.TrySaveTrackingData(records, expectedRevision, out var newRevision))
            return Results.Conflict(new { code = "DATABASE-REVISION-CONFLICT", revision = database.Revision, error = "Die Datenbank wurde zwischenzeitlich geändert. Bitte neu laden." });
        return Results.Ok(new { saved = records.Count, revision = newRevision });
    }
    catch (InvalidDataException ex) { return Results.BadRequest(new { error = ex.Message }); }
});
app.MapDelete("/api/database/tracking", (DatabaseStore database) =>
    Results.Ok(new { deleted = true, revision = database.ClearTrackingData() }));
app.MapGet("/api/database/audit", (DatabaseStore database) =>
    Results.Json(database.LoadRecentAudit()));
app.MapGet("/api/database/backup", (HttpContext c, DatabaseStore database) =>
{
    c.Response.Headers["Cache-Control"] = "no-store";
    var fileName = "teiletracking-db-backup-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + ".json";
    return Results.File(database.CreateBackup(), "application/json; charset=utf-8", fileName);
});
app.MapPost("/api/database/restore/preview", async (HttpContext c, DatabaseStore database) =>
{
    JsonNode? backup;
    try { backup = await JsonNode.ParseAsync(c.Request.Body, documentOptions: new JsonDocumentOptions { MaxDepth = 16 }, cancellationToken: c.RequestAborted); }
    catch (JsonException) { return Results.BadRequest(new { error = "Ungültiges Backup-JSON." }); }
    if (!DatabaseStore.TryDecodeBackup(backup, out var payload, out _, out var error))
        return Results.BadRequest(new { error });
    var records = (JsonArray)payload["trackingRecords"]!;
    return Results.Ok(new {
        valid = true,
        schemaVersion = payload["schemaVersion"]!.GetValue<int>(),
        trackingRecords = records.Count,
        currentTrackingRecords = database.TrackingCount,
        derivate = (payload["masterData"]?["Derivate"] as JsonArray)?.Count ?? 0,
        iStufen = (payload["masterData"]?["IStufen"] as JsonArray)?.Count ?? 0,
        currentRevision = database.Revision
    });
});
app.MapPost("/api/database/restore", async (HttpContext c, DatabaseStore database) =>
{
    JsonNode? data;
    try { data = await JsonNode.ParseAsync(c.Request.Body, documentOptions: new JsonDocumentOptions { MaxDepth = 16 }, cancellationToken: c.RequestAborted); }
    catch (JsonException) { return Results.BadRequest(new { error = "Ungültiges JSON." }); }
    if (data is not JsonObject request || request["revision"] is not JsonValue revNode ||
        !revNode.TryGetValue<long>(out var expectedRevision) ||
        !DatabaseStore.TryDecodeBackup(request["backup"], out var payload, out var backupHash, out var error))
        return Results.BadRequest(new { error = "Restore-Anfrage oder Backup ist ungültig." });
    if (!database.TryRestoreBackup(payload, backupHash, expectedRevision, out var newRevision))
        return Results.Conflict(new { code = "DATABASE-REVISION-CONFLICT", revision = database.Revision, error = "Die Datenbank wurde nach der Vorschau geändert. Bitte Vorschau erneut laden." });
    return Results.Ok(new { restored = true, revision = newRevision, trackingRecords = (payload["trackingRecords"] as JsonArray)?.Count ?? 0 });
});
app.MapGet("/api/interfaces", () => Results.Ok(Interfaces()));
app.MapGet("/api/config", (HttpContext c) =>
{
    if (!IPAddress.IsLoopback(c.Connection.RemoteIpAddress ?? IPAddress.None)) return Results.StatusCode(403);
    var cfg = LoadConfig();
    if (cfg["https"] is JsonObject h) h["pfxPasswordEnvironmentVariable"] = h["pfxPasswordEnvironmentVariable"]?.GetValue<string>() ?? "TEILETRACKING_PFX_PASSWORD";
    cfg.Remove("sharePoint");
    if (cfg["network"] is JsonObject network) network["remoteAccessEnabled"] = false;
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
    if (network is not null) network["remoteAccessEnabled"] = false;
    if ((network?["remoteAccessEnabled"]?.GetValue<bool>() ?? false) &&
        !(https?["enabled"]?.GetValue<bool>() ?? false))
        return Results.BadRequest(new { error = "Remote-Zugriff erfordert HTTPS." });

    cfg["setupCompleted"] = true;
    SaveConfig(cfg);
    Log("INFO", "CONFIG-001", "Konfiguration gespeichert. Änderungen werden nach Neustart aktiv.");
    return Results.Ok(new { saved = true, restartRequired = true });
});
app.MapPost("/api/queue", async (HttpContext c) =>
{
    if (!c.Request.HasJsonContentType())
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
    Log("INFO", "APP-START-001", $"Teiletracking 0.5.0 gestartet; IP={ip ?? "keine"}; Port={port}");
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
<title>Teiletracking – lokale Verwaltung</title><style>
:root{color-scheme:light}body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f3f5f7;color:#20252b}
main{max-width:1040px;margin:auto;padding:24px}.card{background:#fff;border:1px solid #d8dde3;border-radius:12px;padding:20px;margin:16px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.stat{background:#f5f7f9;padding:14px;border-radius:8px}
button,a.btn{display:inline-block;padding:10px 15px;margin:8px 8px 0 0;border:0;border-radius:7px;background:#17365d;color:#fff;text-decoration:none;cursor:pointer;font:inherit}
button.secondary,a.secondary{background:#eef2f5;color:#17212b;border:1px solid #cbd3dc}button.danger{background:#9e2727}
input{box-sizing:border-box;width:min(100%,400px);padding:10px;margin:8px 0}small,.muted{color:#5b6570}.warn{color:#8b4d00}
.audit-row{display:grid;grid-template-columns:180px 1fr 90px;gap:12px;padding:10px 0;border-bottom:1px solid #e3e6ea;font-size:.92rem}
#message{white-space:pre-wrap;padding:10px;border-radius:6px}.error{background:#fff0f0;color:#8d1c1c}.success{background:#eff8f0;color:#165a22}
code{overflow-wrap:anywhere}li{margin:6px 0}@media(max-width:600px){main{padding:12px}.audit-row{grid-template-columns:1fr}.card{padding:14px}}
</style></head><body><main>
<h1>Teiletracking – lokale Verwaltung</h1>
<p class="muted">Die Anwendung und Datenbank laufen nur auf diesem Windows-PC. Es wird keine WLAN- oder Domänenfreigabe geöffnet.</p>
<section class="card"><h2>Datenbankstatus</h2>
<div id="status" class="grid"><div class="stat">Lade Status …</div></div>
<p>Datei: <code>%LOCALAPPDATA%\Teiletracking\teiletracking.db</code></p>
<a class="btn" href="/prototype/">Tracking öffnen und Datensätze verwalten</a>
<button class="secondary" type="button" id="refreshButton">Status aktualisieren</button>
<div><label for="port">Lokaler HTTP-Port</label><br><input id="port" type="number" min="1024" max="65535" value="8000"></div>
<button class="secondary" id="savePort" type="button">Port speichern</button>
<small>Portänderungen werden nach Neustart wirksam. Netzwerkzugriff bleibt fest deaktiviert.</small></section>

<section class="card"><h2>Sicherung und Wiederherstellung</h2>
<p>Die verschlüsselte Sicherung enthält Stammdaten und Tracking-Datensätze. Sie wird mit AES-256-GCM und einem aus dem Passwort abgeleiteten Schlüssel verschlüsselt. Passwortverlust bedeutet Datenverlust. Passwort nicht zusammen mit der Sicherungsdatei aufbewahren.</p>
<button id="encryptedBackup" type="button">Verschlüsselte Sicherung herunterladen</button>
<button id="plainBackup" class="secondary" type="button">Unverschlüsselte Sicherung als Notfallformat</button>
<div><label for="backupFile">Sicherungsdatei wiederherstellen oder prüfen</label><br>
<input id="backupFile" type="file" accept=".ttbackup,.json,application/json"></div>
<button id="restoreButton" class="danger" type="button">Backup prüfen und wiederherstellen</button>
<p class="warn">Eine Wiederherstellung ersetzt den aktuellen Datenbankinhalt vollständig. Erstellt vorab eine verschlüsselte Sicherung und kontrolliert die Vorschau.</p>
<p id="message" aria-live="polite"></p>
</section>

<section class="card"><h2>Lokaler Änderungsverlauf</h2>
<p>Die letzten Datenbankänderungen werden lokal mit Zeit, Vorgang, Anzahl und SHA-256-Prüfwert aufgezeichnet. Der Verlauf enthält keine Datensatzinhalte und keine Benutzerkennung; er ist nicht revisionssicher und wird auf 10.000 Einträge begrenzt.</p>
<div id="audit" class="muted">Lade Verlauf …</div>
<button class="secondary" id="refreshAudit" type="button">Verlauf aktualisieren</button>
</section>

<section class="card"><h2>Übernahme alter Browserdaten</h2>
<ol>
<li>In der alten Browseransicht zuerst die Tracking-Daten als JSON exportieren.</li>
<li>Diese Anwendung über „Tracking öffnen“ starten und im Bereich Tracking-Historie die JSON-Datei importieren.</li>
<li>Anzahl der importierten, übersprungenen und ungültigen Datensätze prüfen. Vorhandene Datensätze werden nicht automatisch gelöscht.</li>
</ol>
<p>Die JSON-Importfunktion bleibt als Ausweichweg erhalten, wenn eine Datenbanksicherung beschädigt oder nicht verfügbar ist.</p>
</section>
</main>
<script src="/prototype/backup-service.js?v=sqlite-v2"></script><script>
const byId = id => document.getElementById(id);
function showMessage(text, kind) { const box=byId("message");box.textContent=text;box.className=kind||""; }
async function requestJson(url, options) {
    const response=await fetch(url,options||{cache:"no-store"});
    let body={};try{body=await response.json()}catch{}
    if(!response.ok)throw new Error(body.error||("HTTP "+response.status));
    return body;
}
async function loadStatus() {
    const s=await requestJson("/api/status");
    byId("status").replaceChildren();
    const cards=[["Version",s.version],["Datensätze",s.trackingRecords],["Datenbankrevision",s.databaseRevision],["Zugriff","Nur dieser PC"]];
    for(const pair of cards){const cell=document.createElement("div");cell.className="stat";const label=document.createElement("b");label.textContent=pair[0];const value=document.createElement("div");value.textContent=String(pair[1]);cell.append(label,value);byId("status").appendChild(cell)}
}
async function loadAudit() {
    const events=await requestJson("/api/database/audit");
    const host=byId("audit");host.replaceChildren();
    if(!events.length){host.textContent="Noch keine Änderungen protokolliert.";return}
    for(const item of events){
        const row=document.createElement("div");row.className="audit-row";
        const date=document.createElement("span");date.textContent=new Date(item.occurredAt).toLocaleString("de-DE");
        const operation=document.createElement("span");operation.textContent=item.operation+" · "+item.recordCount+" Datensätze · SHA-256 "+item.payloadSha256.slice(0,16)+"…";
        const id=document.createElement("span");id.textContent="#"+item.id;
        row.append(date,operation,id);host.appendChild(row);
    }
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function fetchBackup(){const response=await fetch("/api/database/backup",{cache:"no-store"});if(!response.ok)throw new Error("Backup konnte nicht erstellt werden (HTTP "+response.status+").");return response.text()}
async function createEncryptedBackup(){
    const pass=prompt("Backup-Passwort eingeben (mindestens 16 Zeichen). Passwort getrennt von der Datei aufbewahren.");
    if(pass===null)return;if(pass.length<16)throw new Error("Das Passwort muss mindestens 16 Zeichen haben.");
    const again=prompt("Backup-Passwort zur Bestätigung erneut eingeben.");
    if(again===null)return;if(pass!==again)throw new Error("Die Passwörter stimmen nicht überein.");
    const plaintext=await fetchBackup();
    const encrypted=await TeiletrackingBackupService.encrypt(plaintext,pass);
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    downloadBlob(new Blob([JSON.stringify(encrypted)],{type:"application/json"}),"teiletracking-db-backup-"+stamp+".ttbackup");
    showMessage("Verschlüsselte Sicherung erstellt. Passwort separat und sicher aufbewahren.","success");
}
async function createPlainBackup(){
    if(!confirm("Diese Notfallsicherung ist unverschlüsselt und enthält alle gespeicherten Daten. Nur auf einem zugriffsgeschützten, verschlüsselten Datenträger speichern. Fortfahren?"))return;
    const plaintext=await fetchBackup();const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    downloadBlob(new Blob([plaintext],{type:"application/json"}),"teiletracking-db-backup-plain-"+stamp+".json");
    showMessage("Unverschlüsselte Notfallsicherung erstellt. Datei vertraulich behandeln.","warn");
}
async function readBackupFile(file){
    if(!file)throw new Error("Bitte eine Backupdatei auswählen.");
    if(file.size>24*1024*1024)throw new Error("Die Backupdatei ist größer als 24 MiB.");
    let parsed=JSON.parse(await file.text());
    if(TeiletrackingBackupService.isEncryptedPackage(parsed)){
        const pass=prompt("Passwort für die verschlüsselte Sicherung eingeben.");
        if(pass===null)throw new Error("Wiederherstellung abgebrochen.");
        parsed=JSON.parse(await TeiletrackingBackupService.decrypt(parsed,pass));
    }else if(!confirm("Das ausgewählte Backup ist unverschlüsselt. Nur fortfahren, wenn die Datei aus einer vertrauenswürdigen Quelle stammt.")){
        throw new Error("Wiederherstellung abgebrochen.");
    }
    return parsed;
}
async function restoreBackup(){
    const file=byId("backupFile").files[0];const backup=await readBackupFile(file);
    const preview=await requestJson("/api/database/restore/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(backup)});
    const text="Backup geprüft: "+preview.trackingRecords+" Tracking-Datensätze, "+preview.derivate+" Derivate und "+preview.iStufen+" I-Stufen. Aktueller Datenbankstand: Revision "+preview.currentRevision+".";
    showMessage(text,"success");
    if(!confirm(text+"\\n\\nDer komplette aktuelle Datenbankinhalt wird ersetzt. Vorherige Sicherung ist vorhanden? Wiederherstellung jetzt ausführen?"))return;
    const result=await requestJson("/api/database/restore",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({backup,revision:preview.currentRevision})});
    showMessage("Wiederherstellung abgeschlossen. "+result.trackingRecords+" Datensätze übernommen; Revision "+result.revision+".","success");
    await loadStatus();await loadAudit();
}
async function savePort(){
    const cfg=await requestJson("/api/config");
    const value=Number(byId("port").value);
    if(!Number.isInteger(value)||value<1024||value>65535)throw new Error("Port muss zwischen 1024 und 65535 liegen.");
    cfg.network.port=value;cfg.network.remoteAccessEnabled=false;delete cfg.sharePoint;
    const result=await requestJson("/api/config",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg)});
    showMessage(result.restartRequired?"Port gespeichert. Anwendung für die Änderung neu starten.":"Port gespeichert.","success");
}
byId("refreshButton").addEventListener("click",()=>loadStatus().catch(e=>showMessage(e.message,"error")));
byId("refreshAudit").addEventListener("click",()=>loadAudit().catch(e=>showMessage(e.message,"error")));
byId("encryptedBackup").addEventListener("click",()=>createEncryptedBackup().catch(e=>showMessage(e.message,"error")));
byId("plainBackup").addEventListener("click",()=>createPlainBackup().catch(e=>showMessage(e.message,"error")));
byId("restoreButton").addEventListener("click",()=>restoreBackup().catch(e=>showMessage(e.message,"error")));
byId("savePort").addEventListener("click",()=>savePort().catch(e=>showMessage(e.message,"error")));
Promise.all([loadStatus(),loadAudit(),requestJson("/api/config").then(c=>{byId("port").value=c.network.port})]).catch(e=>showMessage(e.message,"error"));
</script></body></html>
""";
}

sealed class DatabaseStore
{
    private const int CurrentSchemaVersion = 2;
    private const int MaximumBackupBytes = 12 * 1024 * 1024;
    private readonly string _connectionString;
    private readonly object _gate = new();

    public int TrackingCount
    {
        get
        {
            using var connection = Open();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM tracking_records";
            return Convert.ToInt32(command.ExecuteScalar());
        }
    }

    public DatabaseStore(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        }.ToString();
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS tracking_records (local_id TEXT PRIMARY KEY, record_json TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS import_batches (batch_id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, imported_count INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                operation TEXT NOT NULL,
                record_count INTEGER NOT NULL,
                payload_sha256 TEXT NOT NULL
            );
            INSERT OR IGNORE INTO app_state(key, value) VALUES ('master_data', '{"Derivate":[],"IStufen":[],"AktivOverrides":{"Derivate":{},"IStufen":{}}}');
            INSERT OR IGNORE INTO app_state(key, value) VALUES ('revision', '0');
            """;
        command.ExecuteNonQuery();

        using var versionCommand = connection.CreateCommand();
        versionCommand.CommandText = "PRAGMA user_version";
        var schemaVersion = Convert.ToInt32(versionCommand.ExecuteScalar());
        if (schemaVersion is 0 or 1)
        {
            versionCommand.CommandText = "PRAGMA user_version = 2";
            versionCommand.ExecuteNonQuery();
        }
        else if (schemaVersion != CurrentSchemaVersion)
        {
            throw new InvalidDataException("Nicht unterstützte SQLite-Datenbankversion: " + schemaVersion);
        }
    }

    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA busy_timeout=5000;";
        command.ExecuteNonQuery();
        return connection;
    }

    private static long ReadRevision(SqliteConnection connection, SqliteTransaction? transaction = null)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT value FROM app_state WHERE key='revision'";
        return long.Parse((string)command.ExecuteScalar()!);
    }

    private static long IncrementRevision(SqliteConnection connection, SqliteTransaction transaction)
    {
        var next = ReadRevision(connection, transaction) + 1;
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "UPDATE app_state SET value=$value WHERE key='revision'";
        command.Parameters.AddWithValue("$value", next.ToString(System.Globalization.CultureInfo.InvariantCulture));
        command.ExecuteNonQuery();
        return next;
    }

    private static string Hash(JsonNode value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.ToJsonString())));

    private static void AppendAudit(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string operation,
        int recordCount,
        string payloadHash)
    {
        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                INSERT INTO audit_events(occurred_at, operation, record_count, payload_sha256)
                VALUES ($at, $operation, $count, $hash)
                """;
            command.Parameters.AddWithValue("$at", DateTimeOffset.UtcNow.ToString("O"));
            command.Parameters.AddWithValue("$operation", operation);
            command.Parameters.AddWithValue("$count", recordCount);
            command.Parameters.AddWithValue("$hash", payloadHash);
            command.ExecuteNonQuery();
        }
        using var prune = connection.CreateCommand();
        prune.Transaction = transaction;
        prune.CommandText = "DELETE FROM audit_events WHERE id NOT IN (SELECT id FROM audit_events ORDER BY id DESC LIMIT 10000)";
        prune.ExecuteNonQuery();
    }

    public long Revision
    {
        get { using var connection = Open(); return ReadRevision(connection); }
    }

    public JsonNode LoadMasterData()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT value FROM app_state WHERE key='master_data'";
        return JsonNode.Parse((string)command.ExecuteScalar()!)!;
    }

    public (JsonArray Records, long Revision) LoadTrackingSnapshot()
    {
        lock (_gate)
        {
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            var revision = ReadRevision(connection, transaction);
            var records = LoadTrackingInTransaction(connection, transaction);
            transaction.Commit();
            return (records, revision);
        }
    }

    private static JsonArray LoadTrackingInTransaction(SqliteConnection connection, SqliteTransaction transaction)
    {
        var records = new JsonArray();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "SELECT record_json FROM tracking_records ORDER BY updated_at, local_id";
        using var reader = command.ExecuteReader();
        while (reader.Read()) records.Add(JsonNode.Parse(reader.GetString(0)));
        return records;
    }

    public JsonArray LoadTrackingData()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT record_json FROM tracking_records ORDER BY updated_at, local_id";
        using var reader = command.ExecuteReader();
        var records = new JsonArray();
        while (reader.Read()) records.Add(JsonNode.Parse(reader.GetString(0)));
        return records;
    }

    public JsonArray LoadRecentAudit()
    {
        lock (_gate)
        {
            using var connection = Open();
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT id, occurred_at, operation, record_count, payload_sha256 FROM audit_events ORDER BY id DESC LIMIT 100";
            using var reader = command.ExecuteReader();
            var events = new JsonArray();
            while (reader.Read())
            {
                events.Add(new JsonObject
                {
                    ["id"] = reader.GetInt64(0),
                    ["occurredAt"] = reader.GetString(1),
                    ["operation"] = reader.GetString(2),
                    ["recordCount"] = reader.GetInt32(3),
                    ["payloadSha256"] = reader.GetString(4)
                });
            }
            return events;
        }
    }

    public long SaveMasterData(JsonNode data)
    {
        lock (_gate)
        {
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = "UPDATE app_state SET value=$value WHERE key='master_data'";
                command.Parameters.AddWithValue("$value", data.ToJsonString());
                command.ExecuteNonQuery();
            }
            var revision = IncrementRevision(connection, transaction);
            AppendAudit(connection, transaction, "MASTER_DATA_SAVED", 0, Hash(data));
            transaction.Commit();
            return revision;
        }
    }

    public bool TrySaveTrackingData(JsonArray records, long expectedRevision, out long newRevision)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var node in records)
        {
            if (node is not JsonObject record)
                throw new InvalidDataException("Jeder Tracking-Datensatz muss ein JSON-Objekt sein.");
            string? id;
            try { id = record["LocalId"]?.GetValue<string>(); }
            catch { throw new InvalidDataException("LocalId muss Text sein."); }
            if (string.IsNullOrWhiteSpace(id))
            {
                id = Guid.NewGuid().ToString("D");
                record["LocalId"] = id;
            }
            if (id.Length > 128 || !ids.Add(id))
                throw new InvalidDataException("LocalId ist zu lang oder innerhalb der Liste doppelt vorhanden.");
        }

        lock (_gate)
        {
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            var currentRevision = ReadRevision(connection, transaction);
            if (currentRevision != expectedRevision)
            {
                transaction.Rollback();
                newRevision = currentRevision;
                return false;
            }
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = "DELETE FROM tracking_records";
                command.ExecuteNonQuery();
            }
            foreach (var record in records.OfType<JsonObject>())
            {
                var id = record["LocalId"]!.GetValue<string>();
                using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = "INSERT INTO tracking_records(local_id, record_json, updated_at) VALUES ($id, $json, $updated)";
                command.Parameters.AddWithValue("$id", id);
                command.Parameters.AddWithValue("$json", record.ToJsonString());
                command.Parameters.AddWithValue("$updated", DateTimeOffset.UtcNow.ToString("O"));
                command.ExecuteNonQuery();
            }
            newRevision = IncrementRevision(connection, transaction);
            AppendAudit(connection, transaction, "TRACKING_SNAPSHOT_SAVED", records.Count, Hash(records));
            transaction.Commit();
            return true;
        }
    }

    public long ClearTrackingData()
    {
        lock (_gate)
        {
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            using var countCommand = connection.CreateCommand();
            countCommand.Transaction = transaction;
            countCommand.CommandText = "SELECT COUNT(*) FROM tracking_records";
            var previousCount = Convert.ToInt32(countCommand.ExecuteScalar());
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = "DELETE FROM tracking_records";
                command.ExecuteNonQuery();
            }
            var revision = IncrementRevision(connection, transaction);
            var marker = new JsonObject { ["deletedRecordCount"] = previousCount };
            AppendAudit(connection, transaction, "TRACKING_CLEARED", previousCount, Hash(marker));
            transaction.Commit();
            return revision;
        }
    }

    public byte[] CreateBackup()
    {
        lock (_gate)
        {
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            JsonNode master;
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = "SELECT value FROM app_state WHERE key='master_data'";
                master = JsonNode.Parse((string)command.ExecuteScalar()!)!;
            }
            var records = LoadTrackingInTransaction(connection, transaction);
            var revision = ReadRevision(connection, transaction);
            transaction.Commit();

            var payload = JsonSerializer.SerializeToUtf8Bytes(new
            {
                format = "TeiletrackingDatabaseBackup",
                formatVersion = 1,
                schemaVersion = CurrentSchemaVersion,
                exportedAt = DateTimeOffset.UtcNow,
                revision,
                masterData = master,
                trackingRecords = records
            });
            var hash = Convert.ToHexString(SHA256.HashData(payload));
            return JsonSerializer.SerializeToUtf8Bytes(new
            {
                formatVersion = 1,
                sha256 = hash,
                payload = Convert.ToBase64String(payload)
            }, new JsonSerializerOptions { WriteIndented = true });
        }
    }

    public static bool TryDecodeBackup(JsonNode? package, out JsonObject payload, out string hash, out string error)
    {
        payload = new JsonObject();
        hash = "";
        error = "Backup ist ungültig.";
        if (package is not JsonObject envelope ||
            envelope["formatVersion"] is not JsonValue versionNode ||
            !versionNode.TryGetValue<int>(out var version) || version != 1 ||
            envelope["sha256"] is not JsonValue hashNode ||
            !hashNode.TryGetValue<string>(out var suppliedHash) ||
            envelope["payload"] is not JsonValue payloadNode ||
            !payloadNode.TryGetValue<string>(out var encoded))
            return false;
        if (encoded.Length > (MaximumBackupBytes * 4 / 3) + 8 || suppliedHash.Length != 64)
        {
            error = "Backup ist zu groß oder enthält einen ungültigen Prüfsummenwert.";
            return false;
        }

        byte[] bytes;
        try { bytes = Convert.FromBase64String(encoded); }
        catch (FormatException) { error = "Backup-Payload ist kein gültiges Base64."; return false; }
        if (bytes.Length > MaximumBackupBytes)
        {
            error = "Backup überschreitet die zulässige Größe.";
            return false;
        }
        var actualHash = Convert.ToHexString(SHA256.HashData(bytes));
        var expectedBytes = Encoding.ASCII.GetBytes(suppliedHash.ToUpperInvariant());
        var actualBytes = Encoding.ASCII.GetBytes(actualHash);
        if (!CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes))
        {
            error = "Backup-Prüfsumme stimmt nicht. Datei wurde nicht angewendet.";
            return false;
        }

        JsonNode? parsed;
        try { parsed = JsonNode.Parse(Encoding.UTF8.GetString(bytes), documentOptions: new JsonDocumentOptions { MaxDepth = 16 }); }
        catch (JsonException) { error = "Backup-Payload enthält ungültiges JSON."; return false; }
        if (parsed is not JsonObject body ||
            body["format"] is not JsonValue formatNode ||
            !formatNode.TryGetValue<string>(out var format) ||
            format != "TeiletrackingDatabaseBackup" ||
            body["formatVersion"] is not JsonValue formatVersionNode ||
            !formatVersionNode.TryGetValue<int>(out var formatVersion) ||
            formatVersion != 1 ||
            body["schemaVersion"] is not JsonValue schemaVersionNode ||
            !schemaVersionNode.TryGetValue<int>(out var schemaVersion) ||
            schemaVersion != CurrentSchemaVersion ||
            body["masterData"] is not JsonObject master ||
            body["trackingRecords"] is not JsonArray records ||
            records.Count > 1000 ||
            !IsBoundedBackupJson(body))
        {
            error = "Backupformat, Schema oder Datenbegrenzung ist ungültig.";
            return false;
        }
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var node in records)
        {
            if (node is not JsonObject record ||
                record["LocalId"] is not JsonValue idNode ||
                !idNode.TryGetValue<string>(out var id) ||
                string.IsNullOrWhiteSpace(id) || id.Length > 128 || !ids.Add(id))
            {
                error = "Backup enthält ungültige oder doppelte LocalId-Werte.";
                return false;
            }
        }

        payload = body;
        hash = actualHash;
        error = "";
        return true;
    }

    private static bool IsBoundedBackupJson(JsonNode? node, int depth = 0)
    {
        if (depth > 16) return false;
        if (node is JsonObject obj)
            return obj.Count <= 128 && obj.All(pair => pair.Key.Length <= 128 && IsBoundedBackupJson(pair.Value, depth + 1));
        if (node is JsonArray array)
            return array.Count <= 1000 && array.All(item => IsBoundedBackupJson(item, depth + 1));
        if (node is JsonValue value)
        {
            try { return value.GetValue<string>().Length <= 8192; } catch { }
            try { _ = value.GetValue<double>(); return true; } catch { }
            try { _ = value.GetValue<bool>(); return true; } catch { }
            return false;
        }
        return true;
    }

    public bool TryRestoreBackup(JsonObject payload, string backupHash, long expectedRevision, out long newRevision)
    {
        var masterData = (JsonObject)payload["masterData"]!.DeepClone();
        var records = (JsonArray)payload["trackingRecords"]!.DeepClone();
        lock (_gate)
        {
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            var currentRevision = ReadRevision(connection, transaction);
            if (currentRevision != expectedRevision)
            {
                transaction.Rollback();
                newRevision = currentRevision;
                return false;
            }
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = "DELETE FROM tracking_records; UPDATE app_state SET value=$master WHERE key='master_data'";
                command.Parameters.AddWithValue("$master", masterData.ToJsonString());
                command.ExecuteNonQuery();
            }
            foreach (var record in records.OfType<JsonObject>())
            {
                var id = record["LocalId"]!.GetValue<string>();
                using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = "INSERT INTO tracking_records(local_id, record_json, updated_at) VALUES ($id, $json, $updated)";
                command.Parameters.AddWithValue("$id", id);
                command.Parameters.AddWithValue("$json", record.ToJsonString());
                command.Parameters.AddWithValue("$updated", DateTimeOffset.UtcNow.ToString("O"));
                command.ExecuteNonQuery();
            }
            newRevision = IncrementRevision(connection, transaction);
            AppendAudit(connection, transaction, "DATABASE_RESTORED", records.Count, backupHash);
            transaction.Commit();
            return true;
        }
    }
}

