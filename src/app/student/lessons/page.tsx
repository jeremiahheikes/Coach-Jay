import { PageHeader } from "@/components/AppShell";
import { VideoGrid } from "@/components/Video";
import { getMyStudentRow, getStudentBundle, requireUser } from "@/lib/data";
import { NotLinked } from "../NotLinked";
import { MarkWatched } from "./MarkWatched";

export default async function LessonsPage() {
  const { user } = await requireUser();
  const me = await getMyStudentRow();
  if (!me) return <><PageHeader title="Lessons" /><NotLinked email={user.email ?? ""} /></>;
  const { assignments } = await getStudentBundle(me.id);
  const todo = assignments.filter((a) => !a.watched_at), done = assignments.filter((a) => a.watched_at);
  return (
    <>
      <PageHeader title="Lessons" eyebrow={`${todo.length} to watch · ${done.length} done`} />
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">To watch</h3>
        <VideoGrid videos={todo.map((a) => a.video)} emptyText="All caught up." extra={(v) => <MarkWatched assignmentId={todo.find((a) => a.video_id === v.id)!.id} />} />
      </section>
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Watched</h3>
          <VideoGrid videos={done.map((a) => a.video)} emptyText="" />
        </section>
      )}
    </>
  );
}
