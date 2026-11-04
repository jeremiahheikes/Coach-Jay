"""Diagnostics: pokes the GoPro over USB and writes what it says to diag.txt next to this file."""
import json, socket, sys, time
from pathlib import Path
import requests

def find():
    addrs = {i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)}
    for a in sorted(addrs):
        p = a.split(".")
        if p[0] == "172" and p[1].startswith("2") and p[2].startswith("1"):
            return ".".join(p[:3] + ["51"])
    sys.exit("no GoPro USB network found")

ip = find(); base = f"http://{ip}:8080"
out = Path(__file__).resolve().parent / "diag.txt"
lines = [f"camera {ip}"]
def try_get(path, **params):
    t = time.time()
    try:
        r = requests.get(base + path, params=params or None, timeout=8)
        body = r.text.strip()
        lines.append(f"{path} {params or ''} -> {r.status_code} in {time.time()-t:.2f}s: {body[:400]}")
        return r
    except Exception as e:
        lines.append(f"{path} {params or ''} -> EXC {e!r}")

try_get("/gopro/version")
try_get("/gopro/camera/info")
try_get("/gopro/camera/control/wired_usb", p=1)
try_get("/gopro/camera/keep_alive")
r = try_get("/gopro/camera/state")
if r is not None and r.ok:
    lines.append("FULL STATE: " + json.dumps(r.json(), sort_keys=True))
try_get("/gopro/camera/presets/get")
try_get("/gopro/camera/presets/set_group", id=1000)
time.sleep(1)
try_get("/gopro/camera/shutter/start")
time.sleep(2)
try_get("/gopro/camera/shutter/stop")
time.sleep(1)
try_get("/gopro/camera/shutter/start", p=1)
time.sleep(2)
try_get("/gopro/camera/shutter/stop", p=0)
time.sleep(1)
r = try_get("/gopro/camera/state")
if r is not None and r.ok:
    lines.append("STATE AFTER: " + json.dumps(r.json().get("status", {}), sort_keys=True))
try_get("/gopro/media/list")
out.write_text("\n".join(lines))
print("\n".join(l[:160] for l in lines))
print(f"\nwritten to {out}")
