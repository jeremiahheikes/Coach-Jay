import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/data";

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const { profile } = await requireUser();
  return <AppShell role="student" name={profile.full_name}>{children}</AppShell>;
}
