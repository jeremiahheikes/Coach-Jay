"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { addScreenShot } from "@/app/coach/actions";
import { BOX_LABELS, DEFAULT_KEYS, parseReading, readingIsUsable, signatureDistance, type Box, type BoxKey, type Layout } from "@/lib/screen";
import { CLUBS } from "@/lib/types";

type Opt = { id: string; name: string; sessionId: string | null };
type Worker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };
type LogRow = { at: string; values: Partial<Record<BoxKey, number | null>>; confidence: number; status: "posted" | "skipped" | "error"; note?: string };

const LS_KEY = "cj-bay-layouts";
const SIG_N = 12; // trigger region is downscaled to SIG_N×SIG_N for change detection
const CHANGE = 0.06; // mean per-pixel change (0–1) that counts as "the panel changed"
const MIN_CONF = 55; // average OCR confidence below this → skipped, shown in the log for a manual post

function loadLayouts(): Layout[] { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function saveLayouts(l: Layout[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(l)); } catch { /* fine */ } }

/**
 * Watches a capture-card feed of the simulator screen. Once the coach has drawn a box over each
 * number, it detects when the shot panel changes, OCRs the boxes, sanity-checks the values and
 * posts a provisional shot into the student's lesson in progress.
 */
export function BayReader({ students }: { students: Opt[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // visible: frame + boxes
  const workRef = useRef<HTMLCanvasElement | null>(null); // hidden: crops
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const lastSigRef = useRef<number[] | null>(null);
  const stableRef = useRef(0);
  const busyRef = useRef(false);
  const lastPostedRef = useRef<string>("");

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [live, setLive] = useState(false);
  const [frameSize, setFrameSize] = useState({ w: 1280, h: 720 });
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [layoutName, setLayoutName] = useState("Bay 2");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [trigger, setTrigger] = useState<BoxKey>("carry");
  const [drawing, setDrawing] = useState<BoxKey | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [club, setClub] = useState("7 Iron");
  const [watching, setWatching] = useState(false);
  const [ocrReady, setOcrReady] = useState<"no" | "loading" | "yes" | "failed">("no");
  const [log, setLog] = useState<LogRow[]>([]);
  const [lastRead, setLastRead] = useState<Partial<Record<BoxKey, number | null>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- devices & stream ----
  const refreshDevices = useCallback(async () => {
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      const vids = d.filter((x) => x.kind === "videoinput");
      setDevices(vids);
      setDeviceId((cur) => cur || (vids.find((v) => /capture|usb video|hdmi|cam link|elgato/i.test(v.label)) ?? vids[0])?.deviceId || "");
    } catch { /* no devices */ }
  }, []);
  useEffect(() => { const t = setTimeout(() => { setLayouts(loadLayouts()); refreshDevices(); }, 0); return () => clearTimeout(t); }, [refreshDevices]);
  const applyLayout = (name: string) => { setLayoutName(name); const l = layouts.find((x) => x.name === name); if (l) { setBoxes(l.boxes); setTrigger(l.trigger); } };

  const start = async () => {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!; v.srcObject = stream; await v.play();
      const t = stream.getVideoTracks()[0]?.getSettings();
      if (t?.width && t?.height) setFrameSize({ w: t.width, h: t.height });
      setLive(true);
      await refreshDevices(); // labels only appear after permission
    } catch (e) { setError(`Couldn't open that video source: ${(e as Error).message}`); }
  };
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setLive(false); setWatching(false); };
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); workerRef.current?.terminate(); }, []);

  // ---- draw frame + boxes ----
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvasRef.current, v = videoRef.current;
      if (c && v && live && v.videoWidth) {
        if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
        const ctx = c.getContext("2d")!;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        ctx.lineWidth = Math.max(2, c.width / 600); ctx.font = `${Math.max(12, c.width / 80)}px sans-serif`;
        for (const b of boxes) {
          ctx.strokeStyle = b.key === trigger ? "#ffb020" : "#5fd38d"; ctx.fillStyle = ctx.strokeStyle;
          ctx.strokeRect(b.x * c.width, b.y * c.height, b.w * c.width, b.h * c.height);
          ctx.fillText(BOX_LABELS[b.key].split(" (")[0]!, b.x * c.width + 4, b.y * c.height - 4);
        }
        if (dragRect) { ctx.strokeStyle = "#fff"; ctx.setLineDash([6, 4]); ctx.strokeRect(dragRect.x * c.width, dragRect.y * c.height, dragRect.w * c.width, dragRect.h * c.height); ctx.setLineDash([]); }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live, boxes, trigger, dragRect]);

  // ---- calibration drawing ----
  const toFrac = (e: React.PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const onDown = (e: React.PointerEvent) => { if (!drawing) return; dragRef.current = toFrac(e); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const s = dragRef.current; if (!s) return; const p = toFrac(e); setDragRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); };
  const onUp = () => {
    const r = dragRect; dragRef.current = null; setDragRect(null);
    if (!drawing || !r || r.w < 0.01 || r.h < 0.01) return;
    setBoxes((bs) => [...bs.filter((b) => b.key !== drawing), { key: drawing, ...r }]);
    setDrawing(null);
  };
  const persist = () => { const next = [...layouts.filter((l) => l.name !== layoutName), { name: layoutName, boxes, trigger }]; setLayouts(next); saveLayouts(next); };

  // ---- OCR ----
  const ensureWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    setOcrReady("loading");
    try {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng", 1, { langPath: "/tess", gzip: true });
      await w.setParameters({ tessedit_char_whitelist: "0123456789.-LR", tessedit_pageseg_mode: "7" as never });
      workerRef.current = w as unknown as Worker; setOcrReady("yes"); return workerRef.current;
    } catch (e) { setOcrReady("failed"); setError(`Reader failed to load: ${(e as Error).message}`); return null; }
  }, []);

  /** Crops a box from the live frame into a clean black-on-white image the OCR likes. */
  const cropBox = (b: Box): HTMLCanvasElement => {
    const v = videoRef.current!;
    const sx = b.x * v.videoWidth, sy = b.y * v.videoHeight, sw = b.w * v.videoWidth, sh = b.h * v.videoHeight;
    const scale = Math.max(1, 120 / sh); // upscale so digits are ~120px tall
    const out = document.createElement("canvas"); out.width = Math.round(sw * scale) + 40; out.height = Math.round(sh * scale) + 40;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(v, sx, sy, sw, sh, 20, 20, out.width - 40, out.height - 40);
    const img = ctx.getImageData(0, 0, out.width, out.height); const d = img.data;
    // grayscale → decide polarity by mean (bright text on dark bg gets inverted) → threshold
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
    const mean = sum / (d.length / 4); const invert = mean < 128;
    for (let i = 0; i < d.length; i += 4) { let g = (d[i]! + d[i + 1]! + d[i + 2]!) / 3; if (invert) g = 255 - g; g = g > 150 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return out;
  };

  const readAll = useCallback(async () => {
    const w = await ensureWorker(); if (!w) return null;
    const values: Partial<Record<BoxKey, number | null>> = {}; const confs: number[] = [];
    for (const b of boxes) {
      const { data } = await w.recognize(cropBox(b));
      values[b.key] = parseReading(data.text, b.key); confs.push(data.confidence);
    }
    return { values, confidence: confs.length ? confs.reduce((a, c) => a + c, 0) / confs.length : 0 };
  }, [boxes, ensureWorker]);

  const post = useCallback(async (values: Partial<Record<BoxKey, number | null>>, confidence: number, force = false) => {
    const key = JSON.stringify(values);
    if (!force && key === lastPostedRef.current) return;
    const at = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
    if (!readingIsUsable(values, trigger)) { setLog((l) => [{ at, values, confidence, status: "skipped", note: "not enough numbers read" } as LogRow, ...l].slice(0, 50)); return; }
    if (!force && confidence < MIN_CONF) { setLog((l) => [{ at, values, confidence, status: "skipped", note: "low confidence — tap Post if it looks right" } as LogRow, ...l].slice(0, 50)); return; }
    const r = await addScreenShot({ student_id: studentId, club, confidence, ...values });
    lastPostedRef.current = key;
    setLog((l) => [{ at, values, confidence, status: r.error ? "error" : "posted", note: r.error } as LogRow, ...l].slice(0, 50));
  }, [studentId, club, trigger]);

  // ---- watch loop: cheap change detection on the trigger box, then OCR when it settles ----
  useEffect(() => {
    if (!watching || !live) return;
    const tb = boxes.find((b) => b.key === trigger); if (!tb) return;
    if (!workRef.current) workRef.current = document.createElement("canvas");
    const wc = workRef.current; wc.width = SIG_N; wc.height = SIG_N;
    const h = setInterval(async () => {
      const v = videoRef.current; if (!v || !v.videoWidth || busyRef.current) return;
      const ctx = wc.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(v, tb.x * v.videoWidth, tb.y * v.videoHeight, tb.w * v.videoWidth, tb.h * v.videoHeight, 0, 0, SIG_N, SIG_N);
      const d = ctx.getImageData(0, 0, SIG_N, SIG_N).data; const sig: number[] = [];
      for (let i = 0; i < d.length; i += 4) sig.push((d[i]! + d[i + 1]! + d[i + 2]!) / 3);
      const prev = lastSigRef.current; lastSigRef.current = sig;
      if (!prev) return;
      const dist = signatureDistance(prev, sig);
      if (dist > CHANGE) { stableRef.current = 0; return; } // still changing (animation, transition)
      stableRef.current += 1;
      if (stableRef.current !== 2) return; // read once, when it has just settled
      busyRef.current = true;
      try { const r = await readAll(); if (r) { setLastRead(r.values); await post(r.values, r.confidence); } } finally { busyRef.current = false; }
    }, 500);
    return () => clearInterval(h);
  }, [watching, live, boxes, trigger, readAll, post]);

  const chosen = students.find((s) => s.id === studentId);
  const fmt = (v: number | null | undefined) => (v == null ? "–" : String(v));

  return (
    <div className="flex flex-col gap-4">
      {/* Source */}
      <div className="card flex flex-wrap items-center gap-2">
        <label className="label">Video source</label>
        <select className="input !w-auto max-w-[280px]" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          {devices.length === 0 && <option value="">(allow camera access to list devices)</option>}
          {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Video input ${i + 1}`}</option>)}
        </select>
        {!live ? <button className="btn btn-primary" onClick={start}>Open feed</button> : <button className="btn" onClick={stop}>Close feed</button>}
        <span className="text-xs text-ink3">{live ? `${frameSize.w}×${frameSize.h}` : "Plug the capture card in first; it shows up as a camera."}</span>
      </div>

      {/* Frame + calibration */}
      <div className="card !p-0 overflow-hidden">
        <div className="relative bg-black">
          <video ref={videoRef} muted playsInline className="hidden" />
          <canvas ref={canvasRef} width={1280} height={720} className={`w-full block ${drawing ? "cursor-crosshair" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
          {!live && <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">No feed yet</div>}
          {drawing && <div className="absolute top-2 left-2 chip !bg-black/70 !text-white">Drag a box around <b className="ml-1">{BOX_LABELS[drawing]}</b> — the number only, not the label</div>}
        </div>
        <div className="p-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="label">Layout</label>
            <input className="input !w-32" value={layoutName} onChange={(e) => applyLayout(e.target.value)} list="cj-layouts" />
            <datalist id="cj-layouts">{layouts.map((l) => <option key={l.name} value={l.name} />)}</datalist>
            <button className="btn btn-sm" onClick={persist} disabled={boxes.length === 0}>Save layout</button>
            <span className="text-xs text-ink3">{boxes.length} of {DEFAULT_KEYS.length} boxes set · trigger: {BOX_LABELS[trigger].split(" (")[0]}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_KEYS.map((k) => {
              const has = boxes.some((b) => b.key === k);
              return (
                <span key={k} className="inline-flex items-center gap-1">
                  <button className={`btn btn-sm ${drawing === k ? "btn-primary" : has ? "" : "!border-dashed"}`} disabled={!live} onClick={() => setDrawing(drawing === k ? null : k)} title={has ? "Redraw" : "Draw"}>{has ? "✓ " : "+ "}{BOX_LABELS[k].split(" (")[0]}</button>
                  {has && <button className="text-xs text-ink3 px-1" onClick={() => setTrigger(k)} title="Use this box to detect a new shot">{trigger === k ? "●" : "○"}</button>}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-ink3 m-0">Tip: the ● box is the one watched for change — pick the number that always changes per shot (carry is a good choice). Boxes are saved per layout name on this laptop.</p>
        </div>
      </div>

      {/* Watch */}
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="label">Student</label>
          <select className="input !w-auto" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((o) => <option key={o.id} value={o.id}>{o.name}{o.sessionId ? " · lesson in progress" : ""}</option>)}
          </select>
          <label className="label">Club</label>
          <select className="input !w-auto" value={club} onChange={(e) => setClub(e.target.value)}>{CLUBS.map((c) => <option key={c}>{c}</option>)}</select>
          <button className={`btn ${watching ? "" : "btn-primary"}`} disabled={!live || boxes.length === 0 || !studentId} onClick={async () => { if (!watching) { await ensureWorker(); lastSigRef.current = null; stableRef.current = 0; } setWatching(!watching); }}>
            {watching ? "■ Stop watching" : "● Watch for shots"}
          </button>
          <button className="btn btn-sm" disabled={!live || boxes.length === 0} onClick={async () => { const r = await readAll(); if (r) { setLastRead(r.values); setLog((l) => [{ at: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }), values: r.values, confidence: r.confidence, status: "skipped", note: "test read (not posted)" } as LogRow, ...l].slice(0, 50)); } }}>Test read</button>
          <span className="text-xs text-ink3">{ocrReady === "loading" ? "Loading reader…" : ocrReady === "failed" ? "Reader failed" : watching ? `Watching · posts to ${chosen?.name ?? "—"}${chosen?.sessionId ? "" : " (opens a lesson)"}` : ""}</span>
        </div>
        {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
        {lastRead && (
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_KEYS.filter((k) => k in lastRead).map((k) => <span key={k} className={`chip num ${lastRead[k] == null ? "chip-bad" : ""}`}>{BOX_LABELS[k].split(" (")[0]} {fmt(lastRead[k])}</span>)}
          </div>
        )}
        {log.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr><th>Time</th><th>Status</th><th className="r">Conf</th>{DEFAULT_KEYS.map((k) => <th key={k} className="r">{BOX_LABELS[k].split(" (")[0]}</th>)}<th /></tr></thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i} className="num">
                    <td>{r.at}</td>
                    <td><span className={`chip ${r.status === "posted" ? "chip-good" : r.status === "error" ? "chip-bad" : "chip-warn"}`}>{r.status}</span>{r.note && <span className="text-xs text-ink3 ml-1">{r.note}</span>}</td>
                    <td className="r">{Math.round(r.confidence)}</td>
                    {DEFAULT_KEYS.map((k) => <td key={k} className="r">{fmt(r.values[k])}</td>)}
                    <td>{r.status !== "posted" && <button className="btn btn-sm" onClick={() => post(r.values, r.confidence, true)}>Post</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
