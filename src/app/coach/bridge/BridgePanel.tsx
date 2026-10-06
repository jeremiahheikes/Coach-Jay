"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBridgeToken, deleteBridgeToken, setBridgeTarget, type ActionState } from "../actions";

export type BridgeRow = { id: string; label: string; active_student_id: string | null; last_seen_at: string | null; created_at: string };

export function BridgePanel({ students, tokens }: { students: { id: string; name: string }[]; tokens: BridgeRow[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBridgeToken, {});
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const h = setInterval(tick, 30_000); return () => clearInterval(h); }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(state.token!); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* user can select the text */ }
  };
  const seen = (iso: string | null) => {
    if (!iso) return { text: "Never connected", cls: "" };
    const mins = now == null ? Infinity : (now - new Date(iso).getTime()) / 60000;
    return mins < 2 ? { text: "Online", cls: "chip-good" } : { text: `Last seen ${new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`, cls: "" };
  };

  return (
    <>
      {state.token && (
        <div className="card flex flex-col gap-2 border-accent">
          <div className="eyebrow">Your new bridge token · copy it now, it won&apos;t be shown again</div>
          <code className="block bg-surface2 rounded-lg px-3 py-2 text-sm break-all select-all">{state.token}</code>
          <button className="btn btn-sm self-start" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Bridges</h3>
        {tokens.length === 0 && <p className="text-sm text-ink3">No bridge yet.</p>}
        {tokens.map((t) => {
          const s = seen(t.last_seen_at);
          return (
            <div key={t.id} className="card flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-[140px]"><b className="block font-semibold">{t.label}</b><span className={`chip ${s.cls}`}>{s.text}</span></span>
              <label className="flex items-center gap-2 text-sm">
                <span className="label">Armed for</span>
                <select className="input !w-auto" value={t.active_student_id ?? ""} disabled={busy}
                  onChange={(e) => start(async () => { await setBridgeTarget(t.id, e.target.value || null); router.refresh(); })}>
                  <option value="">— nobody —</option>
                  {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </label>
              <button className="text-sm text-ink3 hover:text-bad" disabled={busy} onClick={() => start(async () => { await deleteBridgeToken(t.id); router.refresh(); })}>Revoke</button>
            </div>
          );
        })}
      </section>
      <form action={action} className="card flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]"><label className="label" htmlFor="b-label">New bridge name</label><input className="input" id="b-label" name="label" placeholder="Bay 2 laptop" /></div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create token"}</button>
        {state.error && <p role="alert" className="text-sm text-bad w-full">{state.error}</p>}
      </form>
    </>
  );
}
