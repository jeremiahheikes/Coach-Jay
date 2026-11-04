"""Diagnostics: pokes the GoPro over USB and writes what it says to diag.txt (and presets.json) next to this file."""
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
here = Path(__file__).resolve().parent
out = here / "diag.txt"
lines = [f"camera {ip}"]
def try_get(path, limit=300, **params):
    t = time.time()
    try:
        r = requests.get(base + path, params=params or None, timeout=8)
        body = r.text.strip()
        lines.append(f"{path} {params or ''} -> {r.status_code} in {time.time()-t:.2f}s: {body[:limit]}")
        print(lines[-1][:160])
        return r
    except Exception as e:
        lines.append(f"{path} {params or ''} -> EXC {e!r}")
        print(lines[-1][:160])

def files():
    r = requests.get(base + "/gopro/media/list", timeout=8).json()
    return {f"{d['d']}/{f['n']}" for d in r.get("media", []) for f in d.get("fs", [])}

def status(keys=("8", "10", "33", "89", "93", "96", "97", "114", "115", "116")):
    st = requests.get(base + "/gopro/camera/state", timeout=8).json()["status"]
    return {k: st.get(k) for k in keys}

def record_test(label):
    before = files()
    lines.append(f"--- {label}: status before {status()}")
    print(lines[-1])
    r = try_get("/gopro/camera/shutter/start")
    time.sleep(2.5)
    lines.append(f"    status during {status()}")
    try_get("/gopro/camera/shutter/stop")
    time.sleep(2)
    new = sorted(files() - before)
    lines.append(f"    new files: {new}")
    print(lines[-1])
    return bool(new)

try_get("/gopro/camera/control/wired_usb", p=1)
r = try_get("/gopro/camera/presets/get", limit=100)
if r is not None and r.ok:
    (here / "presets.json").write_text(r.text)
try_get("/gopro/webcam/status")
try_get("/gopro/webcam/version")

ok = record_test("A: as-is")
if not ok:
    try_get("/gopro/webcam/exit")
    time.sleep(3)
    try_get("/gopro/webcam/status")
    ok = record_test("B: after webcam/exit")
if not ok:
    try_get("/gopro/camera/control/set_ui_controller", p=2)
    time.sleep(1)
    ok = record_test("C: after set_ui_controller=2")
if not ok:
    try_get("/gopro/camera/presets/set_group", id=1000)
    try_get("/gopro/camera/presets/load", id=0)
    time.sleep(2)
    ok = record_test("D: after loading preset 0 (video standard)")
lines.append(f"RESULT: {'RECORDED' if ok else 'never recorded'}")
out.write_text("\n".join(lines))
print(f"\n{lines[-1]} — written to {out}")
