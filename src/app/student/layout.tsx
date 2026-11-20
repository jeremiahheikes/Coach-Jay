import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getMyStudentRow, requireUser } from "@/lib/data";

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const { profile } = await requireUser();
  if (profile.role === "coach") redirect("/coach");
  // Free members (not on a coach's roster) start at the Welcome hub instead of empty lesson pages.
  const me = await getMyStudentRow();
  if (!me) redirect("/welcome");
  return <AppShell role="student" name={profile.full_name}>{children}</AppShell>;
}
