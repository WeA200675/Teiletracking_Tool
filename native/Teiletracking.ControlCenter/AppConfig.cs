using System.Text.Json;

namespace Teiletracking.ControlCenter;

public sealed class AppConfig
{
    public int Version { get; set; } = 2;
    public bool SetupCompleted { get; set; }
    public NetworkConfig Network { get; set; } = new();
    public SharePointConfig SharePoint { get; set; } = new();
    public SyncConfig Sync { get; set; } = new();

    public static string DataDirectory =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Teiletracking");

    public static string ConfigPath => Path.Combine(DataDirectory, "config.json");

    public static AppConfig Load()
    {
        Directory.CreateDirectory(DataDirectory);
        if (!File.Exists(ConfigPath)) return new AppConfig();
        try
        {
            return JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(ConfigPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AppConfig();
        }
        catch { return new AppConfig(); }
    }

    public void Save()
    {
        Directory.CreateDirectory(DataDirectory);
        var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
        var tmp = ConfigPath + ".tmp";
        File.WriteAllText(tmp, json);
        File.Move(tmp, ConfigPath, true);
    }
}

public sealed class NetworkConfig
{
    public string Mode { get; set; } = "MANUAL_RANGE";
    public string PreferredCidr { get; set; } = "";
    public string PreferredInterface { get; set; } = "";
    public int Port { get; set; } = 8000;
    public bool Monitor { get; set; } = true;
    public bool Https { get; set; }
    public string CertificateThumbprint { get; set; } = "";
}

public sealed class SharePointConfig
{
    public string Mode { get; set; } = "DISABLED";
    public string SiteUrl { get; set; } = "";
    public string ClientId { get; set; } = "";
    public Dictionary<string,string> Lists { get; set; } = new()
    {
        ["Tracking"] = "Steuergeraete", ["Derivate"] = "Derivate", ["IStufen"] = "IStufen",
        ["ImportBatches"] = "ImportBatches", ["ATS"] = "ATS", ["YNummern"] = "YNummern",
        ["Statuswerte"] = "Statuswerte"
    };
    public Dictionary<string,string> Libraries { get; set; } = new() { ["TrackingImportArchiv"] = "TrackingImportArchiv" };
}

public sealed class SyncConfig
{
    public bool Automatic { get; set; }
    public int RetryCount { get; set; } = 3;
    public string Fallback { get; set; } = "PACKAGE";
    public int IntervalSeconds { get; set; } = 60;
    public string ConflictPolicy { get; set; } = "HOLD";
}
