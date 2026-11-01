"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/types";

const SPEEDS = [0.1, 0.25, 0.5, 1] as const;
const FRAME = 1 / 30;

/**
 * Two clips side by side with one transport: play/pause, scrub, speed and frame-step move both.
 * `offset` (seconds) shifts the right clip relative to the left so impact lines up; nudged a frame
 * at a time and remembered per pair on this device.
 */
export function DualPlayer({ left, right, onClose }: { left: Video; right: Video; onClose?: () => void }) {
  const l = useRef<HTMLVideoElement>(null), r = useRef<HTMLVideoElement>(null);
  const [urls, setUrls] = useState<{ l?: string; r?: string; err?: string }>({});
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(0.5);
  const [t, setT] = useState(0); // master time = left clip time
  const [dur, setDur] = useState(0); // left duration
  const [rdur, setRdur] = useState(0);
  const pairKey = `cj-pair-${left.id}-${right.id}`;
  const [offset, setOffset] = useState(() => { try { const v = localStorage.getItem(pairKey); return v ? parseFloat(v) : 0; } catch { return 0; } });
  const [ready, setReady] = useState({ l: false, r: false });

  useEffect(() => {
    let alive = true;
    Promise.all([left, right].map((v) => fetch(`/api/video?id=${v.id}`).then(async (x) => { const j = await x.json().catch(() => ({})); if (!x.ok || !j.url) throw new Error(j.error || `HTTP ${x.status}`); return j.url as string; })))
      .then(([a, b]) => alive && setUrls({ l: a, r: b }))
      .catch((e) => alive && setUrls({ err: `Couldn't load: ${e.message}` }));
    return () => { alive = false; };
  }, [left, right]);

  const clamp = (v: HTMLVideoElement, x: number) => Math.max(0, Math.min(v.duration || 0, x));
  const syncRight = useCallback((time: number) => { const rv = r.current; if (rv && rv.readyState >= 1) rv.currentTime = clamp(rv, time + offset); }, [offset]);
  const seek = useCallback((time: number) => {
    const lv = l.current; if (!lv) return;
    lv.pause(); r.current?.pause(); setPlaying(false);
    lv.currentTime = clamp(lv, time); syncRight(lv.currentTime); setT(lv.currentTime);
  }, [syncRight]);
  const step = (dir: 1 | -1) => { if (l.current) seek(l.current.currentTime + dir * FRAME); };
  const toggle = useCallback(async () => {
    const lv = l.current, rv = r.current; if (!lv || !rv) return;
    if (lv.paused) { syncRight(lv.currentTime); await Promise.allSettled([lv.play(), rv.play()]); setPlaying(true); }
    else { lv.pause(); rv.pause(); setPlaying(false); }
  }, [syncRight]);
  const nudge = (frames: number) => { const o = +(offset + frames * FRAME).toFixed(4); setOffset(o); try { localStorage.setItem(pairKey, String(o)); } catch { /* fine */ } };
  useEffect(() => { syncRight(l.current?.currentTime ?? 0); }, [offset, syncRight]);
  useEffect(() => { [l.current, r.current].forEach((v) => { if (v) v.playbackRate = speed; }); }, [speed, urls]);

  // Drive the readout and keep the right clip from drifting while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const lv = l.current, rv = r.current; if (!lv || !rv) return;
      setT(lv.currentTime);
      const want = lv.currentTime + offset;
      if (Math.abs(rv.currentTime - want) > 0.08) rv.currentTime = clamp(rv, want);
      if (lv.ended) { lv.pause(); rv.pause(); setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, offset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "," ) nudge(-1); else if (e.key === ".") nudge(1);
      else if (["1", "2", "3", "4"].includes(e.key)) setSpeed(SPEEDS[Number(e.key) - 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggle, offset]);

  const fmt = (s: number) => `${Math.floor(s)}.${String(Math.floor((s % 1) * 100)).padStart(2, "0")}s`;
  const pct = dur ? (t / dur) * 100 : 0;
  const bothReady = ready.l && ready.r;

  return (
    <div className="card !p-0 overflow-hidden select-none">
      <div className="grid grid-cols-2 gap-0.5 bg-black">
        {[{ v: left, ref: l, url: urls.l, side: "l" as const }, { v: right, ref: r, url: urls.r, side: "r" as const }].map(({ v, ref, url, side }) => (
          <div key={v.id} className="relative bg-black aspect-[3/4] sm:aspect-video max-h-[60vh]">
            {url ? (
              <video ref={ref} src={url} playsInline preload="auto" muted={side === "r"} className="w-full h-full object-contain" onClick={toggle}
                onLoadedMetadata={(e) => { const el = e.currentTarget; el.playbackRate = speed; if (side === "l") setDur(el.duration); else setRdur(el.duration); setReady((s) => ({ ...s, [side]: true })); if (side === "r") el.currentTime = clamp(el, offset); }}
                onPlay={() => side === "l" && setPlaying(true)} onPause={() => side === "l" && setPlaying(false)} />
            ) : <div className="w-full h-full grid place-items-center text-white/70 text-sm p-4 text-center">{urls.err ?? "Loading…"}</div>}
            <div className="absolute top-2 left-2 chip !bg-black/60 !text-white">{v.title}</div>
          </div>
        ))}
      </div>

      <div className="px-3 pt-3">
        <div className="relative h-8 flex items-center">
          <div className="absolute inset-x-0 h-1.5 rounded bg-surface2" />
          <div className="absolute h-1.5 rounded bg-accent" style={{ width: `${pct}%` }} />
          <input type="range" min={0} max={dur || 0} step={FRAME / 2} value={t} aria-label="Scrub both" onChange={(e) => seek(parseFloat(e.target.value))}
            className="absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer h-8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface" />
        </div>
        <div className="flex justify-between text-xs text-ink3 num -mt-1"><span>{fmt(t)}</span><span>{fmt(dur)}{rdur ? ` · right ${fmt(rdur)}` : ""}</span></div>
      </div>

      <div className="px-3 pb-3 pt-2 flex flex-col gap-2.5">
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-sm" onClick={() => step(-1)} aria-label="Back one frame">‹ frame</button>
          <button className="btn btn-primary w-16" onClick={toggle} disabled={!bothReady} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
          <button className="btn btn-sm" onClick={() => step(1)} aria-label="Forward one frame">frame ›</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5">
            {SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} className={`px-2.5 py-1 rounded-md text-sm font-semibold num ${s === speed ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{s}×</button>)}
          </div>
          <div className="inline-flex items-center gap-1">
            <span className="text-xs text-ink3 mr-1">Line up right clip:</span>
            <button className="btn btn-sm" onClick={() => nudge(-1)} title="Right clip earlier by a frame ( , )">‹</button>
            <span className="chip num">{offset >= 0 ? "+" : ""}{(offset * 30).toFixed(0)} fr</span>
            <button className="btn btn-sm" onClick={() => nudge(1)} title="Right clip later by a frame ( . )">›</button>
            {offset !== 0 && <button className="text-xs text-ink3 px-1" onClick={() => { setOffset(0); try { localStorage.removeItem(pairKey); } catch { /* fine */ } }}>reset</button>}
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-line">
          <h3 className="text-lg font-semibold">{left.title} <span className="text-ink3 font-normal">vs</span> {right.title}</h3>
          {onClose && <button onClick={onClose} className="text-sm text-ink3 hover:text-ink">Close</button>}
        </div>
        <p className="hidden md:block text-[11px] text-ink3 m-0">Keys: space play · ← → frame · , . nudge right clip · 1–4 speed. Pause both on impact, nudge until they match, and the offset is remembered.</p>
      </div>
    </div>
  );
}
