using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace Teiletracking.ControlCenter;

public sealed record AdapterAddress(string InterfaceName, string Description, IPAddress Address, int PrefixLength, bool HasGateway)
{
    public override string ToString() => $"{InterfaceName} — {Address}/{PrefixLength}" + (HasGateway ? " — Gateway" : "");
}

public static class NetworkService
{
    public static List<AdapterAddress> GetIPv4()
    {
        var result = new List<AdapterAddress>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up || nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            var props = nic.GetIPProperties();
            var gateway = props.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork && !g.Address.Equals(IPAddress.Any));
            foreach (var u in props.UnicastAddresses.Where(x => x.Address.AddressFamily == AddressFamily.InterNetwork))
                result.Add(new AdapterAddress(nic.Name, nic.Description, u.Address, u.PrefixLength, gateway));
        }
        return result.OrderByDescending(x => x.HasGateway).ThenBy(x => x.InterfaceName).ToList();
    }

    public static AdapterAddress? Select(AppConfig config)
    {
        var all = GetIPv4();
        if (!string.IsNullOrWhiteSpace(config.Network.PreferredInterface))
        {
            var named = all.Where(x => x.InterfaceName.Equals(config.Network.PreferredInterface, StringComparison.OrdinalIgnoreCase)).ToList();
            var inRange = named.FirstOrDefault(x => InCidr(x.Address, config.Network.PreferredCidr));
            if (inRange != null) return inRange;
        }
        if (!string.IsNullOrWhiteSpace(config.Network.PreferredCidr))
        {
            var ranged = all.FirstOrDefault(x => InCidr(x.Address, config.Network.PreferredCidr));
            if (ranged != null) return ranged;
        }
        return config.Network.Mode == "AUTO" ? all.FirstOrDefault(x => x.HasGateway) ?? all.FirstOrDefault() : null;
    }

    public static string CidrFor(AdapterAddress a)
    {
        var bytes = a.Address.GetAddressBytes();
        var bits = a.PrefixLength;
        for (var i = 0; i < bytes.Length; i++)
        {
            var keep = Math.Clamp(bits - i * 8, 0, 8);
            bytes[i] = keep == 0 ? (byte)0 : (byte)(bytes[i] & (byte)(0xff << (8 - keep)));
        }
        return $"{new IPAddress(bytes)}/{a.PrefixLength}";
    }

    public static bool InCidr(IPAddress address, string cidr)
    {
        if (string.IsNullOrWhiteSpace(cidr)) return false;
        var parts = cidr.Split('/');
        if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var network) || !int.TryParse(parts[1], out var prefix)) return false;
        var a = address.GetAddressBytes(); var n = network.GetAddressBytes();
        if (a.Length != 4 || n.Length != 4 || prefix < 0 || prefix > 32) return false;
        var full = prefix / 8; var rem = prefix % 8;
        for (var i = 0; i < full; i++) if (a[i] != n[i]) return false;
        if (rem == 0) return true;
        var mask = (byte)(0xff << (8 - rem));
        return (a[full] & mask) == (n[full] & mask);
    }
}
