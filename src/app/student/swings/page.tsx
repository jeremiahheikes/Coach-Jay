import { PageHeader } from "@/components/AppShell";
import { VideoGrid } from "@/components/Video";
import { getMyStudentRow, getStudentBundle, requireUser } from "@/lib/data";
import { NotLinked } from "../NotLinked";

export default async function SwingsPage() {
  const { user } = await requireUser();
  const me = await getMyStudentRow();
  if (!me) return <><PageHeader title="My swings" /><NotLinked email={user.email ?? ""} /></>;
  const { swings } = await getStudentBundle(me.id);
  return (
    <>
      <PageHeader title="My swings" eyebrow={`${swings.length} video${swings.length === 1 ? "" : "s"} with coach notes`} />
      <VideoGrid videos={swings} emptyText="Coach Jay hasn't uploaded a swing video yet." />
    </>
  );
}
