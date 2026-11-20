"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ClubTabs({ isCoach }: { isCoach: boolean }) {
  const path = usePathname();
  const tabs: [string, string][] = [["/community", "Feed"], ["/community/ask", "Ask the Coach"], ["/community/chat", "Chat"], ["/community/profile", "My profile"]];
  if (isCoach) tabs.push(["/community/mod", "Moderation"]);
  return (
    <nav className="tabs">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={(href === "/community" ? path === href || path.startsWith("/community/post") : path.startsWith(href)) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
