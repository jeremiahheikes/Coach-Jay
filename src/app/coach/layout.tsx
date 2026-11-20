import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/data";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const { profile } = await requireUser();
  // The proxy routes by sign-up metadata; the profile row is the real authority on who is a coach.
  if (profile.role !== "coach") redirect("/welcome");
  return <AppShell role="coach" name={profile.full_name}>{children}</AppShell>;
}
