"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/types";
import { fmtDate } from "@/lib/types";

const SPEEDS = [0.1, 0.25, 0.5, 1] as const;
const FRAME = 1 / 30; // most phones record 30 or 60 fps; a 1/30 step is a safe "one frame"

/**
 * Slow-motion review player for swing video.
 * Speed presets, frame step, scrub bar, A/B loop, and keyboard shortcuts
 * (space play/pause, ←/→ frame step, [ ] set loop, L toggle loop, 1-4 speeds).
 * Loads a signed URL for the video on mount.
 */
export function ReviewPlayer({ video, onClose, children }: { video: Video; onClose?: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<{ id: string; url: string | null; err: string | null } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(0.5);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [loop, setLoop] = useState<{ a: number | null; b: number | null; on: boolean }>({ a: null, b: null, on: false });
  const [aspect, setAspect] = useState<number | null>(null); // width / height of the clip, once known
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ d: number; z: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/video?id=${video.id}`)
      .then(async (r) => {
        if (!alive) return;
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) throw new Error(j.error || `HTTP ${r.status}`);
        setSrc({ id: video.id, url: j.url, err: null });
      })
      .catch((e) => alive && setSrc({ id: video.id, url: null, err: `Couldn't load this video. ${e instanceof Error ? e.message : ""}`.trim() }));
    return () => { alive = false; };
  }, [video.id]);

  const url = src?.id === video.id ? src.url : null;
  const err = src?.id === video.id ? src.err : null;

  // Keep playbackRate in sync and drive the time readout with rAF while playing (timeupdate is too coarse at 0.1x).
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed, url]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = ref.current; if (!v) return;
      if (loop.on && loop.a != null && loop.b != null && v.currentTime >= loop.b) v.currentTime = loop.a;
      setT(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop]);

  const toggle = useCallback(() => { const v = ref.current; if (!v) return; if (v.paused) v.play(); else v.pause(); }, []);
  const seek = useCallback((time: number) => { const v = ref.current; if (!v) return; v.pause(); v.currentTime = Math.max(0, Math.min(dur || v.duration || 0, time)); setT(v.currentTime); }, [dur]);
  const step = useCallback((dir: 1 | -1) => { const v = ref.current; if (!v) return; seek(v.currentTime + dir * FRAME); }, [seek]);
  const setA = () => setLoop((l) => ({ ...l, a: t, on: l.b != null && t < l.b ? true : l.on }));
  const setB = () => setLoop((l) => ({ ...l, b: t, on: l.a != null && t > l.a ? true : l.on }));
  const clearLoop = () => setLoop({ a: null, b: null, on: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "[") setA();
      else if (e.key === "]") setB();
      else if (e.key.toLowerCase() === "l") setLoop((l) => ({ ...l, on: !l.on && l.a != null && l.b != null }));
      else if (["1", "2", "3", "4"].includes(e.key)) setSpeed(SPEEDS[Number(e.key) - 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggle, step, t]);

  const ZOOMS = [1, 1.5, 2, 3];
  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    const el = frameRef.current; if (!el || z <= 1) return { x: 0, y: 0 };
    const mx = (el.clientWidth * (z - 1)) / 2, my = (el.clientHeight * (z - 1)) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  }, []);
  const applyZoom = (z: number) => { setZoom(z); setPan((p) => clampPan(p, z)); };
  const cycleZoom = () => applyZoom(ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length]!);
  const fullscreen = () => { const el = frameRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el); };

  // Drag to pan when zoomed; a tap (no movement) still toggles play. Two fingers pinch to zoom.
  const onPointerDown = (e: React.PointerEvent) => { if (zoom > 1) { dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } };
  const onPointerMove = (e: React.PointerEvent) => { const d = dragRef.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; setPan(clampPan({ x: d.px + dx, y: d.py + dy }, zoom)); };
  const onPointerUp = () => { const d = dragRef.current; dragRef.current = null; if (!d || !d.moved) toggle(); };
  const onTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 2) { const [a, b] = [e.touches[0]!, e.touches[1]!]; pinchRef.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom }; dragRef.current = null; } };
  const onTouchMove = (e: React.TouchEvent) => { const p = pinchRef.current; if (!p || e.touches.length !== 2) return; e.preventDefault(); const [a, b] = [e.touches[0]!, e.touches[1]!]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); applyZoom(Math.max(1, Math.min(4, p.z * (d / p.d)))); };
  const onTouchEnd = () => { pinchRef.current = null; };

  const pct = dur ? (t / dur) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, "0")}s`;

  return (
    <div className="card !p-0 overflow-hidden select-none">
      <div ref={frameRef} className="relative bg-black overflow-hidden mx-auto w-full touch-none" style={{ aspectRatio: aspect ?? 16 / 9, maxHeight: "75vh" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null; }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {url ? (
          <video ref={ref} src={url} playsInline preload="auto" className="w-full h-full object-contain" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center", cursor: zoom > 1 ? "grab" : "pointer" }}
            onError={() => setSrc({ id: video.id, url: null, err: "The file uploaded but this browser can't play it. Try the Camera app button, or a different browser." })}
            onLoadedMetadata={(e) => { const v = e.currentTarget; setDur(v.duration); v.playbackRate = speed; if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight); }}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => { if (!playing) setT(e.currentTarget.currentTime); }}
            onEnded={() => { if (loop.on && loop.a != null && ref.current) { ref.current.currentTime = loop.a; ref.current.play(); } }} />
        ) : (
          <div className="w-full h-full grid place-items-center text-white/70 text-sm p-4 text-center">{err ?? "Loading…"}</div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <span className="chip !bg-black/60 !text-white num">{speed}×</span>
          <button onClick={cycleZoom} className="chip !bg-black/60 !text-white num" aria-label="Zoom" title="Zoom (pinch on phone, drag to pan)">🔍 {zoom}×</button>
          <button onClick={fullscreen} className="chip !bg-black/60 !text-white" aria-label="Fullscreen" title="Fullscreen">⤢</button>
        </div>
        {zoom > 1 && <button onClick={() => applyZoom(1)} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} className="absolute bottom-2 right-2 chip !bg-black/60 !text-white">Reset zoom</button>}
      </div>

      {/* Scrubber */}
      <div className="px-3 pt-3">
        <div className="relative h-8 flex items-center">
          <div className="absolute inset-x-0 h-1.5 rounded bg-surface2" />
          {loop.a != null && loop.b != null && dur > 0 && (
            <div className="absolute h-1.5 rounded bg-warn/60" style={{ left: `${(loop.a / dur) * 100}%`, width: `${((loop.b - loop.a) / dur) * 100}%` }} />
          )}
          <div className="absolute h-1.5 rounded bg-accent" style={{ width: `${pct}%` }} />
          <input type="range" min={0} max={dur || 0} step={FRAME / 2} value={t} aria-label="Scrub"
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface" />
        </div>
        <div className="flex justify-between text-xs text-ink3 num -mt-1"><span>{fmt(t)}</span><span>{fmt(dur)}</span></div>
      </div>

      {/* Transport */}
      <div className="px-3 pb-3 pt-2 flex flex-col gap-2.5">
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-sm" onClick={() => step(-1)} aria-label="Back one frame" title="← one frame">‹ frame</button>
          <button className="btn btn-primary w-16" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
          <button className="btn btn-sm" onClick={() => step(1)} aria-label="Forward one frame" title="→ one frame">frame ›</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5">
            {SPEEDS.map((s, i) => (
              <button key={s} onClick={() => setSpeed(s)} title={`Key ${i + 1}`} className={`px-2.5 py-1 rounded-md text-sm font-semibold num ${s === speed ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{s}×</button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button className={`btn btn-sm ${loop.a != null ? "!border-warn" : ""}`} onClick={setA} title="Set loop start ( [ )">A{loop.a != null && <span className="text-ink3 num ml-1">{fmt(loop.a)}</span>}</button>
            <button className={`btn btn-sm ${loop.b != null ? "!border-warn" : ""}`} onClick={setB} title="Set loop end ( ] )">B{loop.b != null && <span className="text-ink3 num ml-1">{fmt(loop.b)}</span>}</button>
            <button className={`btn btn-sm ${loop.on ? "btn-primary" : ""}`} disabled={loop.a == null || loop.b == null} onClick={() => setLoop((l) => ({ ...l, on: !l.on }))} title="Toggle loop (L)">Loop</button>
            {(loop.a != null || loop.b != null) && <button className="text-xs text-ink3 px-1" onClick={clearLoop}>clear</button>}
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-line">
          <h3 className="text-lg font-semibold">{video.title}</h3>
          <div className="flex items-center gap-3">
            <span className="eyebrow">{fmtDate(video.recorded_on)}</span>
            {onClose && <button onClick={onClose} className="text-sm text-ink3 hover:text-ink">Close</button>}
          </div>
        </div>
        {children}
        <p className="hidden md:block text-[11px] text-ink3 m-0">Keys: space play · ← → frame · [ ] set loop · L loop on/off · 1–4 speed</p>
      </div>
    </div>
  );
}
