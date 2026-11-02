"""
Coach Jay — GoPro helper (runs on the laptop in the bay).

What it does, in a loop:
  1. Polls Coach Jay for "swing captured" events from the phone (the phone's auto-capture
     announces each swing with its swing id the instant it hears impact).
  2. For each event: tells the GoPro to record (HindSight on the camera means the clip already
     contains the previous 15 s, swing included), waits TAIL_S, stops.
  3. Finds the new file on the camera, downloads it over the USB-C cable, uploads it straight to
     Coach Jay's storage and attaches it to the same swing as the phone's clip.

Setup (once):
  pip install open-gopro requests
  GoPro: USB-C to the laptop; on the camera enable Preferences → Connections → USB Connection → "GoPro Connect"
         (not MTP), and put the "jay" preset on with HindSight 15 s.
  Coach Jay: KIT bridge page → create a token → paste it into config.json next to this file:
    { "api": "https://coach-jay.vercel.app", "token": "cj_..." }

Run:  python helper.py
Stop: Ctrl+C
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

import requests
from open_gopro import WiredGoPro
from open_gopro.models import constants

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.json"
TMP = HERE / "clips"
TAIL_S = 2.5          # keep recording this long after the phone heard impact
POLL_S = 0.5          # how often to ask Coach Jay for new swings
SETTLE_S = 1.5        # give the camera a moment to finish writing the file


def log(msg: str) -> None:
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def load_config() -> dict:
    if not CONFIG.exists():
        sys.exit(f"Missing {CONFIG}. Create it with: {{\"api\": \"https://coach-jay.vercel.app\", \"token\": \"cj_...\"}}")
    cfg = json.loads(CONFIG.read_text())
    if not cfg.get("token", "").startswith("cj_"):
        sys.exit("config.json needs a bridge token from the KIT bridge page (starts with cj_).")
    cfg.setdefault("api", "https://coach-jay.vercel.app")
    return cfg


class CoachJay:
    def __init__(self, cfg: dict):
        self.base = cfg["api"].rstrip("/")
        self.h = {"Authorization": f"Bearer {cfg['token']}"}

    def events(self) -> list[dict]:
        r = requests.get(f"{self.base}/api/bridge/events", headers=self.h, timeout=10)
        r.raise_for_status()
        return r.json().get("events", [])

    def upload(self, student_id: str, path: Path) -> str:
        r = requests.post(f"{self.base}/api/bridge/upload-url", headers=self.h, json={"student_id": student_id, "ext": path.suffix.lstrip(".")}, timeout=10)
        r.raise_for_status()
        j = r.json()
        with path.open("rb") as f:
            up = requests.put(j["url"], data=f, headers={"Content-Type": "video/mp4", "x-upsert": "false"}, timeout=600)
        up.raise_for_status()
        return j["path"]

    def done(self, event_id: str, path: str | None, error: str | None = None) -> None:
        requests.post(f"{self.base}/api/bridge/clip-done", headers=self.h, json={"event_id": event_id, "path": path, "error": error}, timeout=10).raise_for_status()


async def capture(gopro: WiredGoPro, cj: CoachJay, ev: dict) -> None:
    """Record TAIL_S more (HindSight supplies the swing itself), fetch the new file, send it up."""
    before = {f.filename for f in (await gopro.http_command.get_media_list()).data.files}
    log(f"swing {ev['swing_id'][:8]} — recording")
    assert (await gopro.http_command.set_shutter(shutter=constants.Toggle.ENABLE)).ok
    await asyncio.sleep(TAIL_S)
    assert (await gopro.http_command.set_shutter(shutter=constants.Toggle.DISABLE)).ok
    await asyncio.sleep(SETTLE_S)
    after = {f.filename for f in (await gopro.http_command.get_media_list()).data.files}
    new = sorted(after - before)
    if not new:
        cj.done(ev["id"], None, "camera produced no file (is HindSight / video mode on?)")
        log("no new file on the camera")
        return
    camera_file = new[-1]
    TMP.mkdir(exist_ok=True)
    local = TMP / f"{ev['swing_id']}.mp4"
    t0 = time.time()
    await gopro.http_command.download_file(camera_file=camera_file, local_file=local)
    log(f"downloaded {camera_file} ({local.stat().st_size // 1_000_000} MB) in {time.time() - t0:.1f}s")
    t1 = time.time()
    path = cj.upload(ev["student_id"], local)
    cj.done(ev["id"], path)
    log(f"attached to swing in {time.time() - t1:.1f}s")
    try:
        local.unlink()
    except OSError:
        pass


async def main() -> None:
    cfg = load_config()
    cj = CoachJay(cfg)
    log("connecting to the GoPro over USB…")
    async with WiredGoPro() as gopro:
        assert (await gopro.http_command.set_keep_alive()).ok
        log("GoPro connected. Waiting for swings from the phone (Ctrl+C to stop).")
        backoff = POLL_S
        while True:
            try:
                for ev in cj.events():
                    try:
                        await capture(gopro, cj, ev)
                    except Exception as e:  # noqa: BLE001
                        log(f"capture failed: {e!r}")
                        try:
                            cj.done(ev["id"], None, repr(e))
                        except Exception:  # noqa: BLE001
                            pass
                backoff = POLL_S
            except requests.RequestException as e:
                log(f"Coach Jay unreachable: {e}; retrying")
                backoff = min(backoff * 2, 10)
            await asyncio.sleep(backoff)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nbye")
