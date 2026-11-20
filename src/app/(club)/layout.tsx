import { AppShell, type ShellRole } from "@/components/AppShell";
import { getMyStudentRow, requireUser } from "@/lib/data";

/** Welcome hub + Clubhouse: open to every signed-in user — coach, roster students and free members. */
export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const role: ShellRole = profile.role === "coach" ? "coach" : (await getMyStudentRow()) ? "student" : "member";
  return <AppShell role={role} name={profile.full_name}>{children}</AppShell>;
}
