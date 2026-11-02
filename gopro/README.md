# GoPro helper

Runs on the laptop in the bay. Each time the phone saves a swing, the helper triggers the GoPro
(HindSight on, so the clip already holds the swing), pulls the file over the USB-C cable, and
attaches it to the same swing in Coach Jay. Both views land on the student's screen in ~30 s.

## One-time setup (Windows)
1. Install Python 3.11+ from python.org (tick "Add to PATH"). Then in PowerShell:
   `pip install open-gopro requests`
2. GoPro: Preferences → Connections → USB Connection → **GoPro Connect**. Use the "jay" preset
   (1080p120, Linear, HindSight 15 s). Plug the USB-C cable into the laptop.
3. Coach Jay → KIT bridge → create a token (label it "GoPro helper"). Save it as `config.json`
   next to `helper.py`:
   `{ "api": "https://coach-jay.vercel.app", "token": "cj_..." }`

## Run
`python helper.py` — leave the window open during the lesson. Ctrl+C to stop.

## What you'll see
Each swing: "recording" → "downloaded GX010042.MP4 (38 MB) in 4.1s" → "attached to swing in 12.3s".
If it says "no new file on the camera", HindSight or video mode isn't set on the camera.
