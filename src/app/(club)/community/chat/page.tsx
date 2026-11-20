import Link from "next/link";
import { requireUser } from "@/lib/data";
import { listChannels, listMessages } from "@/lib/club";
import { ChatRoom } from "@/components/club/ChatRoom";

export default async function ChatPage(props: PageProps<"/community/chat">) {
  const { c } = await props.searchParams;
  const { user, profile } = await requireUser();
  const isCoach = profile.role === "coach";
  const channels = await listChannels();
  const current = channels.find((ch) => ch.slug === c) ?? channels.find((ch) => ch.slug === "general") ?? channels[0];
  if (!current) return <div className="card text-sm text-ink2">Chat isn&apos;t set up yet — run the Clubhouse database update.</div>;
  const messages = await listMessages(current.slug);
  const canPost = !profile.banned_at && (isCoach || !current.coach_only);
  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {channels.map((ch) => (
          <Link key={ch.slug} href={`/community/chat?c=${ch.slug}`} className={`chip !py-1.5 !px-3 ${ch.slug === current.slug ? "!bg-accent !text-accent-ink" : ""}`}># {ch.name}</Link>
        ))}
      </div>
      {current.description && <p className="text-sm text-ink2 m-0">{current.description}</p>}
      <ChatRoom
        key={current.slug} channel={current.slug} initial={messages} uid={user.id} isCoach={isCoach} canPost={canPost}
        readOnlyNote={profile.banned_at ? "Your posting access is paused." : "Only Coach Jay posts here. Chat in #general."}
      />
    </>
  );
}
