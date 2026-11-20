"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMessage, report, sendMessage } from "@/app/(club)/community/actions";
import type { Author, ClubMessage } from "@/lib/club";
import { initials } from "@/lib/types";

const time = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Live chat for one channel. New messages stream in over Supabase Realtime; a slow poll covers dropped connections. */
export function ChatRoom({ channel, initial, uid, isCoach, canPost, readOnlyNote }: {
  channel: string; initial: ClubMessage[]; uid: string; isCoach: boolean; canPost: boolean; readOnlyNote?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<ClubMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const authors = useRef(new Map<string, Author>());
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { for (const m of initial) if (m.author) authors.current.set(m.author_id, m.author); }, [initial]);

  const merge = (incoming: ClubMessage[]) => setMsgs((cur) => {
    const byId = new Map(cur.map((m) => [m.id, m]));
    for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m, author: m.author ?? byId.get(m.id)?.author ?? null });
    return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-200);
  });

  const authorFor = async (id: string): Promise<Author | null> => {
    const known = authors.current.get(id);
    if (known) return known;
    const { data } = await supabase.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle();
    if (data) authors.current.set(id, data as Author);
    return (data as Author) ?? null;
  };

  useEffect(() => {
    const sub = supabase.channel(`club:${channel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "club_messages", filter: `channel=eq.${channel}` }, async (payload) => {
        const row = payload.new as Omit<ClubMessage, "author">;
        merge([{ ...row, author: await authorFor(row.author_id) }]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "club_messages" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setMsgs((cur) => cur.filter((m) => m.id !== id));
      })
      .subscribe();
    // Backup poll every 20 s while visible (realtime off, phone asleep, flaky signal).
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.from("club_messages").select("*, author:profiles!club_messages_author_id_fkey(id, full_name, role)")
        .eq("channel", channel).order("created_at", { ascending: false }).limit(50);
      if (data) merge((data as (Omit<ClubMessage, "author"> & { author: Author | Author[] | null })[]).map((m) => ({ ...m, author: Array.isArray(m.author) ? m.author[0] ?? null : m.author })));
    }, 20000);
    return () => { supabase.removeChannel(sub); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, supabase]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await sendMessage(channel, body);
      if (r.error) { setError(r.error); return; }
      setText("");
      if (r.id) merge([{ id: r.id, channel, author_id: uid, body, created_at: new Date().toISOString(), author: await authorFor(uid) }]);
    });
  }

  return (
    <div className="card !p-0 flex flex-col min-h-[55vh] max-h-[70vh]">
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {msgs.length === 0 && <p className="text-sm text-ink3 m-auto text-center">No messages yet. Start the conversation.</p>}
        {msgs.map((m) => {
          const name = m.author?.full_name || "Member";
          const mine = m.author_id === uid;
          return (
            <div key={m.id} className="flex gap-2.5 group">
              <span className={`avatar !w-8 !h-8 !text-xs ${m.author?.role === "coach" ? "!bg-accent !text-accent-ink" : ""}`}>{initials(name) || "?"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <b className="text-sm font-semibold">{name}</b>
                  {m.author?.role === "coach" && <span className="chip chip-accent !py-0 !text-[11px]">Coach</span>}
                  <span className="text-[11px] text-ink3">{time(m.created_at)}</span>
                  <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 ml-auto flex gap-2">
                    {(mine || isCoach)
                      ? <button className="text-[11px] text-ink3 hover:text-bad" onClick={() => start(async () => { await deleteMessage(m.id); setMsgs((c) => c.filter((x) => x.id !== m.id)); })}>Delete</button>
                      : <button className="text-[11px] text-ink3 hover:text-ink" onClick={() => start(async () => { const r = await report({ message_id: m.id }); setError(r.error ?? "Reported — Coach Jay will take a look."); })}>Report</button>}
                  </span>
                </div>
                <p className="m-0 text-sm whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="border-t border-line p-3 flex flex-col gap-2">
        {canPost ? (
          <div className="flex gap-2">
            <input
              className="input" placeholder={`Message #${channel}`} value={text} maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="btn btn-primary" disabled={pending || !text.trim()} onClick={send}>Send</button>
          </div>
        ) : <p className="text-sm text-ink3 m-0">{readOnlyNote}</p>}
        {error && <p role="status" className="text-xs text-ink2 m-0">{error}</p>}
      </div>
    </div>
  );
}
