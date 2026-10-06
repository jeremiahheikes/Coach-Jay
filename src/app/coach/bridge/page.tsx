import { PageHeader } from "@/components/AppShell";
import { listStudents, requireUser } from "@/lib/data";
import { BridgePanel, type BridgeRow } from "./BridgePanel";

export default async function BridgePage() {
  const { supabase } = await requireUser();
  const [students, tokens] = await Promise.all([
    listStudents(),
    supabase.from("bridge_tokens").select("id, label, active_student_id, last_seen_at, created_at").order("created_at"),
  ]);
  return (
    <>
      <PageHeader title="KIT bridge" eyebrow="Full Swing KIT → live ball data" />
      <div className="card flex flex-col gap-2 text-sm text-ink2">
        <p className="m-0">The bridge is a small Windows program that runs on the laptop next to the KIT. It listens for each shot and sends it here. Before a lesson, arm the bridge with the student on the mat; every shot lands in their profile as they hit it.</p>
        <ol className="m-0 pl-5 flex flex-col gap-1">
          <li>Create a bridge token below and copy it. It is shown once.</li>
          <li>On the laptop, run the bridge from the <code>bridge/</code> folder with that token (see its README).</li>
          <li>Arm a student, then hit balls. Switch students between lessons.</li>
        </ol>
      </div>
      <BridgePanel students={students.map((s) => ({ id: s.id, name: s.full_name }))} tokens={(tokens.data ?? []) as BridgeRow[]} />
    </>
  );
}
