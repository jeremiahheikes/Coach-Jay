import { PageHeader } from "@/components/AppShell";
import { BallData } from "@/components/BallData";
import { getMyStudentRow, getStudentBundle, requireUser } from "@/lib/data";
import { NotLinked } from "../NotLinked";

export default async function NumbersPage() {
  const { user } = await requireUser();
  const me = await getMyStudentRow();
  if (!me) return <><PageHeader title="My numbers" /><NotLinked email={user.email ?? ""} /></>;
  const { averages } = await getStudentBundle(me.id);
  return (
    <>
      <PageHeader title="My numbers" eyebrow="Session averages by club" />
      <BallData averages={averages} />
    </>
  );
}
