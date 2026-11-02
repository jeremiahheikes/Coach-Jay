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
      <PageHeader title="Laptop helpers" eyebrow="GoPro helper · Full Swing KIT bridge" />
      <div className="card flex flex-col gap-2 text-sm text-ink2">
        <p className="m-0">Two small programs run on the laptop in the bay, both signed in with a token from this page (shown once when you create it).</p>
        <ul className="m-0 pl-5 flex flex-col gap-1">
          <li><b>GoPro helper</b> (<code>gopro/helper.py</code>): each time the phone saves a swing, it triggers the GoPro over the USB-C cable, pulls the clip and attaches it to that swing as the down-the-line view. See its README.</li>
          <li><b>KIT bridge</b> (<code>bridge/</code>): sends each Full Swing KIT shot here live. Arm a student below so shots land in their lesson. Needs Full Swing SDK credentials.</li>
        </ul>
      </div>
      <BridgePanel students={students.map((s) => ({ id: s.id, name: s.full_name }))} tokens={(tokens.data ?? []) as BridgeRow[]} />
    </>
  );
}
