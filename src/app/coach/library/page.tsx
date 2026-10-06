import { PageHeader } from "@/components/AppShell";
import { VideoGrid } from "@/components/Video";
import { listLessons, requireUser } from "@/lib/data";
import { LessonUpload } from "./LessonUpload";

export default async function LibraryPage() {
  const { supabase } = await requireUser();
  const lessons = await listLessons();
  const { data: counts } = await supabase.from("assignments").select("video_id");
  const assignedCount = new Map<string, number>();
  for (const a of counts ?? []) assignedCount.set(a.video_id, (assignedCount.get(a.video_id) ?? 0) + 1);
  const cats = [...new Set(lessons.map((l) => l.category || "Uncategorized"))];

  return (
    <>
      <PageHeader title="Video lessons" eyebrow={`${lessons.length} lessons · ${cats.length} categories`} />
      <LessonUpload />
      {lessons.length === 0 && <p className="text-ink2">No lessons yet. Upload your first one above, then assign it to students from their profile.</p>}
      {cats.map((c) => (
        <section key={c} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{c}</h3>
          <VideoGrid videos={lessons.filter((l) => (l.category || "Uncategorized") === c)} emptyText="" extra={(v) => <span className="text-xs text-ink3">Assigned to {assignedCount.get(v.id) ?? 0}</span>} />
        </section>
      ))}
    </>
  );
}
