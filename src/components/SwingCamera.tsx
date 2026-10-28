"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * In-app camera for recording one swing at a time without leaving the lesson page.
 * Live preview → tap Record → tap Stop → the clip is handed to `onClip` and the
 * preview stays live for the next swing. Uses the phone's rear camera by default.
 *
 * Phones record at 30 fps here (browser cameras don't expose 240 fps slo-mo);
 * the review player's frame-step still works, just coarser than a camera-app slo-mo clip.
 */
export function SwingCamera({ onClip, busy, maxSeconds = 20 }: { onClip: (file: File) => void; busy?: boolean; maxSeconds?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [state, setState] = useState<"off" | "starting" | "live" | "recording">("off");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const stop = useCallback(() => {
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setState("live");
    } catch (e) {
      setState("off");
      const name = (e as DOMException)?.name;
      setError(name === "NotAllowedError" ? "Camera access was blocked. Allow the camera for this site in your browser settings and try again."
        : name === "NotFoundError" ? "No camera found on this device."
        : "Couldn't start the camera.");
    }
  }, [facing]);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const flip = async () => { const next = facing === "environment" ? "user" : "environment"; setFacing(next); if (state !== "off") await start(next); };

  const record = () => {
    const stream = streamRef.current; if (!stream) return;
    const mime = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 16_000_000 } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      const type = rec.mimeType || mime || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: type.split(";")[0] });
      setState(streamRef.current ? "live" : "off");
      setElapsed(0);
      if (blob.size > 0) onClip(new File([blob], `swing-${Date.now()}.${ext}`, { type: blob.type }));
    };
    rec.start(250);
    recRef.current = rec;
    setState("recording");
    const t0 = Date.now();
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setElapsed(s);
      if (s >= maxSeconds && rec.state === "recording") rec.stop();
    }, 100);
  };
  const stopRecording = () => { if (recRef.current?.state === "recording") recRef.current.stop(); };

  if (!supported) return <p className="text-sm text-ink3 m-0">In-app recording isn&apos;t available in this browser — use Record swing below, which opens the camera app.</p>;

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
        {state === "recording" && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC {elapsed.toFixed(1)}s
          </div>
        )}
        {state !== "off" && (
          <button onClick={flip} aria-label="Switch camera" className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white grid place-items-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7" /><path d="M17 3v4h-4M7 21v-4h4" /></svg>
          </button>
        )}
        {(state === "live" || state === "recording") && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-6">
            {state === "live" ? (
              <button onClick={record} disabled={busy} aria-label="Record swing" className="w-16 h-16 rounded-full border-4 border-white grid place-items-center disabled:opacity-50">
                <span className="w-12 h-12 rounded-full bg-red-500" />
              </button>
            ) : (
              <button onClick={stopRecording} aria-label="Stop" className="w-16 h-16 rounded-full border-4 border-white grid place-items-center">
                <span className="w-7 h-7 rounded-sm bg-red-500" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink3">{state === "off" ? "Camera is off." : state === "recording" ? `Tap the square to stop (auto-stops at ${maxSeconds}s).` : "Tap the red button right before the swing; tap again after the finish."}</span>
        {state !== "off" && <button onClick={stop} className="btn btn-sm">Turn off</button>}
      </div>
      {error && <p role="alert" className="text-sm text-bad m-0">{error}</p>}
    </div>
  );
}
