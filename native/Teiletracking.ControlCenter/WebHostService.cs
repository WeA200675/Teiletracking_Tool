using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;

namespace Teiletracking.ControlCenter;

public sealed class WebHostService : IAsyncDisposable
{
    private WebApplication? _app;
    public bool Running => _app != null;
    public string? LastError { get; private set; }

    public async Task StartAsync(AppConfig config)
    {
        if (_app != null) return;
        LastError = null;
        var root = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (!Directory.Exists(Path.Combine(root, "prototype")))
            throw new DirectoryNotFoundException($"Webdateien fehlen: {root}");

        try
        {
            var builder = WebApplication.CreateSlimBuilder();
            builder.WebHost.UseKestrel(k =>
            {
                k.Listen(IPAddress.Any, config.Network.Port, listen =>
                {
                    if (config.Network.Https)
                    {
                        var cert = FindCertificate(config.Network.CertificateThumbprint)
                            ?? throw new InvalidOperationException("HTTPS ist aktiviert, aber das Zertifikat wurde im Windows-Zertifikatsspeicher nicht gefunden.");
                        listen.UseHttps(cert);
                    }
                });
            });
            builder.Services.AddRouting();
            var app = builder.Build();
            app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(root), DefaultFileNames = { "index.html" } });
            app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(root) });
            app.MapGet("/health", () => Results.Json(new { status = "ok", version = typeof(WebHostService).Assembly.GetName().Version?.ToString() ?? "dev" }));
            app.MapGet("/", () => Results.Redirect("/prototype/"));
            await app.StartAsync();
            _app = app;
        }
        catch (Exception ex) { LastError = ex.Message; throw; }
    }

    public async Task StopAsync()
    {
        if (_app == null) return;
        await _app.StopAsync();
        await _app.DisposeAsync();
        _app = null;
    }

    private static X509Certificate2? FindCertificate(string thumbprint)
    {
        if (string.IsNullOrWhiteSpace(thumbprint)) return null;
        foreach (var location in new[] { StoreLocation.CurrentUser, StoreLocation.LocalMachine })
        {
            using var store = new X509Store(StoreName.My, location);
            store.Open(OpenFlags.ReadOnly);
            var found = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint.Replace(" ", ""), validOnly: true);
            if (found.Count > 0) return found[0];
        }
        return null;
    }

    public async ValueTask DisposeAsync() => await StopAsync();
}
