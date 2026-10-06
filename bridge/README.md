# KIT bridge

A small Windows console program that sits on the laptop next to the Full Swing KIT, listens for each shot through
Full Swing's **LM Connect SDK**, and posts it to the Coach Jay app so it lands in the armed student's profile live.

## Before you start
1. **Request SDK credentials from Full Swing Golf.** The SDK is public on NuGet, but it only connects with an
   `AccountId` and `AccountKey` they issue. Ask for "LM Connect SDK access" and describe the coaching use.
2. **Install the .NET 8 SDK** on the laptop: https://dotnet.microsoft.com/download
3. **Create a bridge token** in the app under *KIT bridge* and copy it.

## Run
```
cd bridge
copy appsettings.example.json appsettings.json      # then fill in the four values
dotnet run
```
The bridge finds the KIT on the local Wi-Fi, connects, and prints every shot as it posts it. Leave the window open
during lessons. Arm a student on the app's *KIT bridge* page; switch students between lessons.

## Offline safety
If the app can't be reached, shots are queued in `queue.jsonl` next to the program and retried every 10 seconds,
so a Wi-Fi hiccup never loses a shot.

## Notes
- The bridge is not a Full Swing product. Full Swing's SDK is licensed LGPL-3.0; this program only links to it.
- The club name comes from whatever club is selected on the KIT. Change it on the KIT (or the Full Swing app) as the student switches clubs.
