// KIT bridge — streams Full Swing KIT shots to the Coach Jay app.
// Build/run: dotnet run   (see README.md)

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FullSwingGolf.LaunchMonitor;

var cfg = JsonSerializer.Deserialize<Settings>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "appsettings.json")))
          ?? throw new Exception("appsettings.json missing or invalid. Copy appsettings.example.json and fill it in.");

var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", cfg.CoachJay.BridgeToken);
var queuePath = Path.Combine(AppContext.BaseDirectory, "queue.jsonl");
var queueLock = new SemaphoreSlim(1, 1);

Console.WriteLine("Coach Jay · KIT bridge");
Console.WriteLine($"→ {cfg.CoachJay.ApiUrl}");

// 1. Check the app accepts our token before touching the KIT.
try
{
    var ping = await http.PostAsJsonAsync(cfg.CoachJay.ApiUrl, new { ping = true });
    var body = await ping.Content.ReadFromJsonAsync<PingReply>();
    if (!ping.IsSuccessStatusCode) throw new Exception($"{(int)ping.StatusCode} {body?.error}");
    Console.WriteLine(body?.armed == true ? "App reachable. A student is armed." : "App reachable. No student armed yet — pick one on the KIT bridge page.");
}
catch (Exception ex)
{
    Console.WriteLine($"Could not reach the app: {ex.Message}. Shots will queue until it comes back.");
}

// 2. Connect to the KIT.
await Connect.Initialize(cfg.FullSwing.AccountId, cfg.FullSwing.AccountKey);
IReadOnlyList<IDevice> devices = await Connect.FindDevicesAsync();
while (devices.Count == 0)
{
    Console.WriteLine("No KIT found on this network. Is it on and on the same Wi-Fi? Retrying in 5s…");
    await Task.Delay(5000);
    devices = await Connect.FindDevicesAsync();
}
var device = devices[0];
await device.Connect();
await device.SetConfiguration(ConfigurationId.AutoArm, true);
Console.WriteLine($"Connected to KIT {device.SerialNumber}. Waiting for shots… (Ctrl+C to stop)");

device.ShotEvent += async (_, e) =>
{
    var s = e.Shot;
    var shot = new OutgoingShot(
        club: SafeClubName(device),
        hitAt: s.Timestamp.ToUniversalTime().ToString("o"),
        clubSpeed: s.ClubSpeed, ballSpeed: s.BallSpeed, smashFactor: s.SmashFactor,
        launchAngle: s.VerticalLaunchAngle, launchDirection: s.HorizontalLaunchAngle,
        spinRate: s.SpinRate, spinAxis: s.SpinAxis, faceAngle: s.FaceAngle, attackAngle: s.AttackAngle, clubPath: s.ClubPath,
        carry: s.CarryDistance, total: s.TotalDistance, side: s.Side, apex: s.Apex,
        raw: new { s.Id, s.DeviceId, s.SideTotal });
    Console.WriteLine($"{DateTime.Now:HH:mm:ss}  {shot.club,-8} carry {shot.carry,5:0}  ball {shot.ballSpeed,5:0} mph  launch {shot.launchAngle,4:0.0}°  spin {shot.spinRate,5:0}");
    if (!await Post([shot])) await Enqueue(shot);
};

// 3. Retry anything queued while the app was unreachable.
_ = Task.Run(async () =>
{
    while (true)
    {
        await Task.Delay(10_000);
        await queueLock.WaitAsync();
        try
        {
            if (!File.Exists(queuePath)) continue;
            var lines = File.ReadAllLines(queuePath).Where(l => l.Length > 0).ToList();
            if (lines.Count == 0) continue;
            var shots = lines.Select(l => JsonSerializer.Deserialize<OutgoingShot>(l)!).ToList();
            if (await Post(shots)) { File.Delete(queuePath); Console.WriteLine($"Sent {shots.Count} queued shot(s)."); }
        }
        finally { queueLock.Release(); }
    }
});

await Task.Delay(Timeout.Infinite);

// ---------- helpers ----------
async Task<bool> Post(List<OutgoingShot> shots)
{
    try
    {
        var r = await http.PostAsJsonAsync(cfg.CoachJay.ApiUrl, new { shots });
        if (r.IsSuccessStatusCode) return true;
        var reply = await r.Content.ReadFromJsonAsync<PingReply>();
        Console.WriteLine($"  app said {(int)r.StatusCode}: {reply?.error}");
        return false;
    }
    catch (Exception ex) { Console.WriteLine($"  send failed: {ex.Message}"); return false; }
}

async Task Enqueue(OutgoingShot shot)
{
    await queueLock.WaitAsync();
    try { File.AppendAllText(queuePath, JsonSerializer.Serialize(shot) + Environment.NewLine); Console.WriteLine("  queued for retry"); }
    finally { queueLock.Release(); }
}

static string SafeClubName(IDevice d)
{
    // The SDK exposes the selected club through device configuration; the exact accessor varies by SDK version.
    try { return d.GetConfiguration(ConfigurationId.ClubType)?.ToString() ?? "Unknown"; } catch { return "Unknown"; }
}

// ---------- types ----------
record Settings(FullSwingSettings FullSwing, CoachJaySettings CoachJay);
record FullSwingSettings(string AccountId, string AccountKey);
record CoachJaySettings(string ApiUrl, string BridgeToken);
record PingReply(bool? ok, bool? armed, string? error);

record OutgoingShot(
    string club, string hitAt,
    double? clubSpeed, double? ballSpeed, double? smashFactor,
    double? launchAngle, double? launchDirection,
    double? spinRate, double? spinAxis, double? faceAngle, double? attackAngle, double? clubPath,
    double? carry, double? total, double? side, double? apex,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] object? raw);
