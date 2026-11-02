"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * In-app camera for recording one swing at a time without leaving the lesson page.
 *
 * Two modes:
 *  - Manual: tap Record before the swing, tap Stop after (or a clicker's Page Down).
 *  - Auto-capture: the phone keeps two overlapping rolling recordings so there is always
 *    ≥4 s of history, listens on the mic for the strike, and on impact lets the recording
 *    run 2.5 s more, then saves and hands the clip to `onClip`. No button per swing.
 *
 * Phones record at 30–60 fps here (browser cameras don't expose 240 fps slo-mo).
 */
const WINDOW_S = 8;      // each rolling recorder lives this long before it's replaced
const STAGGER_S = 4;     // a new rolling recorder starts every STAGGER_S, so history is always ≥ STAGGER_S
const TAIL_S = 2.5;      // keep recording this long after impact
const REFRACTORY_S = 4;  // ignore further impacts for this long after one

type Roll = { rec: MediaRecorder; chunks: Blob[]; startedAt: number; capturing: boolean };

export function SwingCamera({ onClip, busy, maxSeconds = 30 }: { onClip: (file: File) => void; busy?: boolean; maxSeconds?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [state, setState] = useState<"off" | "starting" | "live" | "recording">("off");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [autoStopped, setAutoStopped] = useState(false);
  const autoStopRef = useRef(false);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  // ---- auto-capture state ----
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [armed, setArmed] = useState(false);
  const [sensitivity, setSensitivity] = useState(6); // 1 (needs a loud strike) … 10 (very sensitive)
  const [level, setLevel] = useState(0);              // mic level 0–1 for the meter
  const [lastImpact, setLastImpact] = useState<number | null>(null);
  const [captures, setCaptures] = useState(0);
  const rollsRef = useRef<Roll[]>([]);
  const rollTimerRef = useRef<number | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; raf: number } | null>(null);
  const floorRef = useRef(0.02);       // running noise floor (RMS)
  const lastTriggerRef = useRef(0);
  const armedRef = useRef(false);
  const mimeRef = useRef("");

  const beep = (hz = 880, ms = 180) => { try { const ac = new AudioContext(); const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = hz; g.gain.value = 0.15; o.start(); o.stop(ac.currentTime + ms / 1000); } catch { /* no audio */ } };

  const pickMime = () => ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const fileFrom = (chunks: Blob[], mime: string) => {
    const type = (mime || "video/webm").split(";")[0]!;
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(chunks, { type });
    return blob.size > 0 ? new File([blob], `swing-${Date.now()}.${ext}`, { type }) : null;
  };

  // ---- stream ----
  const stop = useCallback(() => {
    disarm();
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("off");
     
  }, []);

  const start = useCallback(async (mode = facing) => {
    setError(null); setState("starting");
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // Audio is on so the mic can hear impact (and the strike is audible in review). Processing off so transients survive.
      let stream: MediaStream;
      const video = { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } };
      try { stream = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
      streamRef.current = stream;
      mimeRef.current = pickMime();
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setState("live");
    } catch (e) {
      setState("off");
      const name = (e as DOMException)?.name;
      setError(name === "NotAllowedError" ? "Camera access was blocked. Allow the camera (and microphone, for auto-capture) for this site and try again."
        : name === "NotFoundError" ? "No camera found on this device."
        : "Couldn't start the camera.");
    }
  }, [facing]);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); disarm(); streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);  

  const flip = async () => { const next = facing === "environment" ? "user" : "environment"; setFacing(next); if (state !== "off") { disarm(); await start(next); } };

  // ---- manual recording ----
  const record = () => {
    const stream = streamRef.current; if (!stream) return;
    const mime = mimeRef.current;
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 16_000_000 } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      setState(streamRef.current ? "live" : "off");
      setElapsed(0);
      if (autoStopRef.current) { autoStopRef.current = false; setAutoStopped(true); beep(); window.setTimeout(() => setAutoStopped(false), 2500); }
      const f = fileFrom(chunksRef.current, rec.mimeType || mime); if (f) onClip(f);
    };
    rec.start(250);
    recRef.current = rec;
    setState("recording");
    const t0 = Date.now();
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setElapsed(s);
      if (s >= maxSeconds && rec.state === "recording") { autoStopRef.current = true; rec.stop(); }
    }, 100);
  };
  const stopRecording = () => { if (recRef.current?.state === "recording") recRef.current.stop(); };

  // ---- auto-capture: rolling recorders ----
  const startRoll = () => {
    const stream = streamRef.current; if (!stream) return;
    const mime = mimeRef.current;
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10_000_000 } : undefined);
    const roll: Roll = { rec, chunks: [], startedAt: Date.now(), capturing: false };
    rec.ondataavailable = (e) => { if (e.data.size) roll.chunks.push(e.data); };
    rec.onstop = () => {
      rollsRef.current = rollsRef.current.filter((r) => r !== roll);
      if (roll.capturing) { const f = fileFrom(roll.chunks, rec.mimeType || mime); if (f) { onClip(f); setCaptures((c) => c + 1); } }
      roll.chunks = [];
    };
    rec.start(500);
    rollsRef.current.push(roll);
  };
  const tickRolls = () => {
    if (!armedRef.current) return;
    const now = Date.now();
    // retire rolls past the window that aren't mid-capture
    for (const r of rollsRef.current) if (!r.capturing && now - r.startedAt > WINDOW_S * 1000 && r.rec.state === "recording") r.rec.stop();
    // keep one fresh roll in reserve
    const live = rollsRef.current.filter((r) => !r.capturing);
    const newest = live.reduce((a, r) => Math.max(a, r.startedAt), 0);
    if (live.length === 0 || now - newest >= STAGGER_S * 1000) startRoll();
  };
  const onImpact = () => {
    const now = Date.now();
    if (now - lastTriggerRef.current < REFRACTORY_S * 1000) return;
    lastTriggerRef.current = now;
    const candidates = rollsRef.current.filter((r) => !r.capturing && r.rec.state === "recording");
    if (candidates.length === 0) return;
    const best = candidates.reduce((a, r) => (r.startedAt < a.startedAt ? r : a)); // most history
    best.capturing = true;
    setLastImpact(now);
    beep(1320, 90);
    window.setTimeout(() => { if (best.rec.state === "recording") best.rec.stop(); }, TAIL_S * 1000);
    startRoll(); // replace it so history keeps building for the next swing
  };

  // ---- auto-capture: mic listener ----
  const listen = () => {
    const stream = streamRef.current; if (!stream || stream.getAudioTracks().length === 0) { setError("No microphone on this stream — auto-capture needs mic access."); return false; }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let frame = 0;
    const loop = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0, peak = 0;
      for (let i = 0; i < buf.length; i++) { const v = buf[i]!; sum += v * v; const a = Math.abs(v); if (a > peak) peak = a; }
      const rms = Math.sqrt(sum / buf.length);
      // slow noise floor; don't let a strike itself raise it much
      floorRef.current = floorRef.current * 0.995 + Math.min(rms, floorRef.current * 3 + 0.001) * 0.005;
      const ratio = peak / Math.max(floorRef.current, 0.004);
      // sensitivity 1..10 → needs a peak this many × the noise floor
      const need = 3 + (10 - sensitivity) * 1.6; // 3× … 17.4×
      if ((frame++ & 3) === 0) setLevel(Math.min(1, peak));
      if (armedRef.current && ratio > need && peak > 0.08) onImpact();
      if (audioRef.current) audioRef.current.raf = requestAnimationFrame(loop);
    };
    audioRef.current = { ctx, analyser, raf: requestAnimationFrame(loop) };
    return true;
  };

  const arm = () => {
    if (state !== "live") return;
    if (!listen()) return;
    armedRef.current = true; setArmed(true);
    startRoll();
    rollTimerRef.current = window.setInterval(tickRolls, 500);
  };
  function disarm() {
    armedRef.current = false; setArmed(false);
    if (rollTimerRef.current) { window.clearInterval(rollTimerRef.current); rollTimerRef.current = null; }
    for (const r of rollsRef.current) { r.capturing = false; if (r.rec.state === "recording") r.rec.stop(); }
    rollsRef.current = [];
    if (audioRef.current) { cancelAnimationFrame(audioRef.current.raf); audioRef.current.ctx.close().catch(() => {}); audioRef.current = null; }
    setLevel(0);
  }
  const toggleArm = () => (armed ? disarm() : arm());

  // Clicker / keyboard: Page Down, Right, Enter, B.  Manual: record/stop.  Auto: counts as an impact (manual trigger).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!["PageDown", "ArrowRight", "Enter", "KeyB"].includes(e.code)) return;
      e.preventDefault();
      if (busy || autoStopped) return;
      if (state === "off") { start(); return; }
      if (mode === "auto") { if (armed) onImpact(); else arm(); return; }
      if (state === "live") record();
      else if (state === "recording") stopRecording();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, busy, autoStopped, start, mode, armed]);

  if (!supported) return <p className="text-sm text-ink3 m-0">In-app recording isn&apos;t available in this browser — use the gallery button below.</p>;

  const since = lastImpact ? Math.round((Date.now() - lastImpact) / 1000) : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4] sm:aspect-video max-h-[70vh]">
        <video ref={videoRef} playsInline muted autoPlay className={`w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`} />
        {state === "off" && (
          <button onClick={() => start()} className="absolute inset-0 grid place-items-center text-white/90">
            <span className="flex flex-col items-center gap-2">
              <span className="w-14 h-14 rounded-full border-2 border-white/80 grid place-items-center"><svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 10l5-2.5v9L16 14z" /></svg></span>
              <span className="text-sm font-semibold">Turn on camera</span>
            </span>
          </button>
        )}
        {state === "starting" && <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">Starting camera…</div>}
        {autoStopped && <div className="absolute inset-x-0 top-0 bg-warn text-black text-sm font-semibold text-center py-2">Recording stopped at {maxSeconds}s and saved — one tap per swing keeps clips short</div>}
        {state === "recording" && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC {elapsed.toFixed(1)}s
          </div>
        )}
        {mode === "auto" && armed && (
          <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-good animate-pulse" /> LISTENING
            <span className="w-16 h-1.5 rounded bg-white/20 overflow-hidden"><span className="block h-full bg-good" style={{ width: `${Math.round(level * 100)}%` }} /></span>
            {captures > 0 && <span>· {captures} saved{since != null && since < 60 ? ` · ${since}s ago` : ""}</span>}
          </div>
        )}
        {state !== "off" && (
          <button onClick={flip} aria-label="Switch camera" className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white grid place-items-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7" /><path d="M17 3v4h-4M7 21v-4h4" /></svg>
          </button>
        )}
        {(state === "live" || state === "recording") && mode === "manual" && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-6">
            {state === "live" ? (
              <button onClick={record} disabled={busy || autoStopped} aria-label="Record swing" className="w-16 h-16 rounded-full border-4 border-white grid place-items-center disabled:opacity-50"><span className="w-12 h-12 rounded-full bg-red-500" /></button>
            ) : (
              <button onClick={stopRecording} aria-label="Stop" className="w-16 h-16 rounded-full border-4 border-white grid place-items-center"><span className="w-7 h-7 rounded-sm bg-red-500" /></button>
            )}
          </div>
        )}
        {state === "live" && mode === "auto" && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
            <button onClick={toggleArm} className={`btn !py-3 !px-5 ${armed ? "" : "btn-primary"}`}>{armed ? "■ Stop listening" : "● Listen for swings"}</button>
            {armed && <button onClick={onImpact} className="btn !py-3" title="Save the last few seconds now">Save now</button>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5">
          {(["manual", "auto"] as const).map((m) => (
            <button key={m} onClick={() => { if (m === "manual") disarm(); setMode(m); }} className={`px-2.5 py-1 rounded-md text-sm font-semibold ${mode === m ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{m === "manual" ? "Tap to record" : "Auto-capture"}</button>
          ))}
        </div>
        {mode === "auto" && (
          <label className="flex items-center gap-2 text-xs text-ink3">Sensitivity
            <input type="range" min={1} max={10} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="w-28" />
            <span className="num w-4">{sensitivity}</span>
          </label>
        )}
        {state !== "off" && <button onClick={stop} className="btn btn-sm">Turn off</button>}
      </div>
      <span className="text-xs text-ink3">
        {state === "off" ? "Camera is off. A clicker's Page Down turns it on."
          : mode === "auto" ? (armed ? "Listening. Each strike saves the ~6 s before it and 2.5 s after. Misses strikes → raise sensitivity. Fires on talking → lower it. Page Down saves now." : "Tap Listen for swings, then just hit balls.")
          : state === "recording" ? `Tap the square or Page Down to stop (auto-stops at ${maxSeconds}s).` : "Red button or Page Down before the swing; again after the finish."}
      </span>
      {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
    </div>
  );
}
