using System.Net.Sockets;
using System.Text.Json;

namespace Teiletracking.ControlCenter;

public sealed record DiagnosticResult(string Code, bool Ok, string Message);

public static class DiagnosticsService
{
    public static async Task<List<DiagnosticResult>> RunAsync(AppConfig config, WebHostService host)
    {
        var r = new List<DiagnosticResult>();
        var selected = NetworkService.Select(config);
        r.Add(new("NET-IP-001", selected != null, selected == null ? "Keine passende IPv4-Adresse gefunden." : $"{selected.InterfaceName}: {selected.Address}/{selected.PrefixLength}"));

        var portFree = host.Running || await IsPortFree(config.Network.Port);
        r.Add(new("NET-PORT-002", portFree, portFree ? $"Port {config.Network.Port} verfügbar/aktiv." : $"Port {config.Network.Port} wird von einem anderen Prozess verwendet."));
        r.Add(new("APP-HEALTH-001", host.Running, host.Running ? "Lokaler Webserver läuft." : "Lokaler Webserver läuft nicht."));

        if (config.SharePoint.Mode == "DISABLED")
            r.Add(new("SP-DISABLED", true, "SharePoint ist deaktiviert."));
        else if (!Uri.TryCreate(config.SharePoint.SiteUrl, UriKind.Absolute, out var site) || site.Scheme != Uri.UriSchemeHttps)
            r.Add(new("SP-NET-003", false, "SharePoint-Site-URL fehlt oder ist ungültig."));
        else
        {
            try
            {
                using var client = new HttpClient(new HttpClientHandler { UseDefaultCredentials = true }) { Timeout = TimeSpan.FromSeconds(10) };
                using var req = new HttpRequestMessage(HttpMethod.Get, site);
                using var resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
                r.Add(new("SP-NET-003", true, $"SharePoint-Endpunkt erreichbar (HTTP {(int)resp.StatusCode}). Authentifizierung/Listenzugriff wird erst im freigegebenen Connector geprüft."));
            }
            catch (Exception ex) { r.Add(new("SP-NET-003", false, $"SharePoint nicht erreichbar: {ex.Message}")); }
        }

        Directory.CreateDirectory(AppConfig.DataDirectory);
        await File.WriteAllTextAsync(Path.Combine(AppConfig.DataDirectory, "diagnostics.json"),
            JsonSerializer.Serialize(r, new JsonSerializerOptions { WriteIndented = true }));
        return r;
    }

    private static async Task<bool> IsPortFree(int port)
    {
        try
        {
            using var c = new TcpClient();
            var task = c.ConnectAsync("127.0.0.1", port);
            var done = await Task.WhenAny(task, Task.Delay(250));
            return done != task || !c.Connected;
        }
        catch { return true; }
    }
}
