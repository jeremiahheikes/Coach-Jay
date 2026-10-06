import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/data";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const { profile } = await requireUser();
  return <AppShell role="coach" name={profile.full_name}>{children}</AppShell>;
}
