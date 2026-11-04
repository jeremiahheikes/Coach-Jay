"""
Coach Jay — GoPro helper (runs on the laptop in the bay).

What it does, in a loop:
  1. Polls Coach Jay for "swing captured" events from the phone (the phone's auto-capture
     announces each swing with its swing id the instant it hears impact).
  2. For each event: tells the GoPro to record (HindSight on the camera means the clip already
     contains the previous 15 s, swing included), waits TAIL_S, stops.
  3. Finds the new file on the camera, downloads it over the USB-C cable, uploads it straight to
     Coach Jay's storage and attaches it to the same swing as the phone's clip.

Talks to the camera with GoPro's wired HTTP API (Open GoPro) over the USB-C cable — no Bluetooth,
no Wi-Fi, no GoPro SDK. Only `requests` is needed.

Setup (once):
  python -m pip install requests imageio-ffmpeg
  GoPro: USB-C to the laptop; on the camera: Preferences → Connections → USB Connection → "GoPro Connect"
         (not MTP), and put the "jay" preset on with HindSight 15 s.
  Coach Jay: Helpers page → create a token → paste it into config.json next to this file:
    { "api": "https://coach-jay.vercel.app", "token": "cj_..." }
  (optional) "camera_ip": "172.2X.1YY.51" in config.json if auto-detection can't find the camera.

Run:  python helper.py
Stop: Ctrl+C
"""
from __future__ import annotations

import json
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "config.json"
TMP = HERE / "clips"
TAIL_S = 2.5          # keep recording this long after the phone heard impact
POLL_S = 0.5          # how often to ask Coach Jay for new swings
SETTLE_S = 1.5        # give the camera a moment to finish writing the file
KEEPALIVE_S = 3.0     # GoPro wants a nudge every few seconds or it dozes off
KEEP_S = 6.0          # seconds of the clip to upload (the swing is in the last few seconds of HindSight)
HINDSIGHT_OPTION = 2  # setting 167: 2 = 15 s, 3 = 30 s, 4 = off


def log(msg: str) -> None:
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def load_config() -> dict:
    if not CONFIG.exists():
        print("First run. In Coach Jay go to Helpers, create a token, copy it, and paste it here.")
        token = input("token (starts with cj_): ").strip()
        if not token.startswith("cj_"):
            sys.exit("That doesn't look like a Coach Jay token. Run me again.")
        CONFIG.write_text(json.dumps({"api": "https://coach-jay.vercel.app", "token": token}, indent=2))
        print(f"saved to {CONFIG}")
    cfg = json.loads(CONFIG.read_text())
    if not cfg.get("token", "").startswith("cj_"):
        sys.exit("config.json needs a bridge token from the Helpers page (starts with cj_).")
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


class GoPro:
    """The camera over the USB cable. Its address is 172.2X.1YY.51 (X/YY from the serial number);
    the laptop's USB network adapter gets 172.2X.1YY.5x from the camera, so we find it from there."""

    def __init__(self, ip: str | None = None):
        self.ip = ip or self.find()
        self.base = f"http://{self.ip}:8080"
        self.last_keepalive = 0.0

    @staticmethod
    def find() -> str:
        addrs = {info[4][0] for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)}
        for a in sorted(addrs):
            p = a.split(".")
            if p[0] == "172" and p[1].startswith("2") and p[2].startswith("1"):
                return ".".join(p[:3] + ["51"])
        sys.exit("Can't find the GoPro's USB network. Is the cable in, the camera on, and USB Connection set to \"GoPro Connect\"?\n"
                 "If it is, add \"camera_ip\": \"172.2X.1YY.51\" to config.json (X = 3rd-from-last digit of the serial, YY = last two).")

    def get(self, path: str, timeout: float = 5.0, **params) -> requests.Response:
        r = requests.get(self.base + path, params=params or None, timeout=timeout)
        r.raise_for_status()
        return r

    def connect(self) -> None:
        self.get("/gopro/camera/control/wired_usb", p=1)   # take wired control
        self.keepalive(force=True)
        st = self.get("/gopro/camera/state").json().get("status", {})
        if st.get("115") == 1:
            # The camera is showing its "USB connected" lock screen; in that state it won't record on
            # command. Unplugging and replugging the cable clears it (the data link survives).
            sys.exit("The GoPro is on its \"USB connected\" screen and won't record like that.\n"
                     "Unplug the USB cable from the camera, plug it back in, wait 10 s, then run me again.")
        try:
            self.get("/gopro/camera/setting", setting=167, option=HINDSIGHT_OPTION)
            log("HindSight set to 15 s")
        except requests.RequestException as e:
            log(f"couldn't turn HindSight on from here ({e}); turn it on in the preset on the camera")
        log(self.why())

    def keepalive(self, force: bool = False) -> None:
        if force or time.time() - self.last_keepalive > KEEPALIVE_S:
            try:
                self.get("/gopro/camera/keep_alive")
            except requests.RequestException:
                pass
            self.last_keepalive = time.time()

    def shutter(self, on: bool) -> None:
        r = requests.get(self.base + "/gopro/camera/shutter/" + ("start" if on else "stop"), timeout=5)
        if not r.ok:
            raise RuntimeError(f"camera refused shutter {'start' if on else 'stop'} ({r.status_code} {r.text.strip()[:120]}); {self.why()}")

    def why(self) -> str:
        """A short readout of why the camera might be refusing: busy, encoding, SD card, mode."""
        try:
            st = self.get("/gopro/camera/state").json().get("status", {})
        except Exception as e:  # noqa: BLE001
            return f"state unavailable: {e}"
        keys = {"8": "busy", "10": "encoding", "33": "sd", "96": "group", "97": "preset", "114": "control", "115": "pc_locked"}
        return "state: " + ", ".join(f"{keys.get(k, k)}={st[k]}" for k in keys if k in st)

    def files(self) -> set[str]:
        out: set[str] = set()
        for d in self.get("/gopro/media/list").json().get("media", []):
            for f in d.get("fs", []):
                out.add(f"{d['d']}/{f['n']}")
        return out

    def download(self, camera_file: str, local: Path) -> None:
        with requests.get(f"{self.base}/videos/DCIM/{camera_file}", stream=True, timeout=120) as r:
            r.raise_for_status()
            with local.open("wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)


def ffmpeg_exe() -> str | None:
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001
        return shutil.which("ffmpeg")


def trim(src: Path, dst: Path) -> bool:
    """Keep the last KEEP_S seconds, shrink to 720p at a modest bitrate so the upload is a few MB.
    Frame rate is kept, so slow-motion still works in the app. Returns False if ffmpeg isn't available."""
    exe = ffmpeg_exe()
    if not exe:
        return False
    cmd = [exe, "-y", "-loglevel", "error", "-sseof", f"-{KEEP_S}", "-i", str(src), "-vf", "scale=-2:720",
           "-c:v", "libx264", "-preset", "ultrafast", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(dst)]
    subprocess.run(cmd, check=True, timeout=120)
    return dst.exists() and dst.stat().st_size > 0


def capture(gopro: GoPro, cj: CoachJay, ev: dict) -> None:
    """Record TAIL_S more (HindSight supplies the swing itself), fetch the new file, send it up."""
    before = gopro.files()
    log(f"swing {ev['swing_id'][:8]} — recording")
    gopro.shutter(True)
    time.sleep(TAIL_S)
    gopro.shutter(False)
    time.sleep(SETTLE_S)
    new = sorted(gopro.files() - before)
    if not new:
        cj.done(ev["id"], None, "camera produced no file (is HindSight / video mode on?)")
        log("no new file on the camera")
        return
    camera_file = new[-1]
    TMP.mkdir(exist_ok=True)
    local = TMP / f"{ev['swing_id']}.mp4"
    t0 = time.time()
    gopro.download(camera_file, local)
    log(f"downloaded {camera_file} ({local.stat().st_size // 1_000_000} MB) in {time.time() - t0:.1f}s")
    t1 = time.time()
    small = TMP / f"{ev['swing_id']}-small.mp4"
    try:
        if trim(local, small):
            log(f"trimmed to last {KEEP_S:.0f}s ({small.stat().st_size // 1_000_000} MB) in {time.time() - t1:.1f}s")
            local.unlink(missing_ok=True)
            local = small
        else:
            log("ffmpeg not found — uploading the whole clip (run: python -m pip install imageio-ffmpeg)")
    except Exception as e:  # noqa: BLE001
        log(f"trim failed ({e!r}) — uploading the whole clip")
    t1 = time.time()
    path = cj.upload(ev["student_id"], local)
    cj.done(ev["id"], path)
    log(f"attached to swing in {time.time() - t1:.1f}s")
    try:
        local.unlink()
    except OSError:
        pass


def main() -> None:
    cfg = load_config()
    cj = CoachJay(cfg)
    log("looking for the GoPro on the USB cable…")
    gopro = GoPro(cfg.get("camera_ip"))
    try:
        gopro.connect()
    except requests.RequestException as e:
        sys.exit(f"Found the USB network at {gopro.ip} but the camera didn't answer: {e}\nOn the camera check Preferences → Connections → USB Connection → \"GoPro Connect\".")
    log(f"GoPro connected at {gopro.ip}. Waiting for swings from the phone (Ctrl+C to stop).")
    backoff = POLL_S
    while True:
        gopro.keepalive()
        try:
            for ev in cj.events():
                try:
                    capture(gopro, cj, ev)
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
        time.sleep(backoff)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nbye")
