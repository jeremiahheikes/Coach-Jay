import Link from "next/link";
import { NavLinks, type NavItem } from "./NavLinks";
import { signOut } from "@/app/(auth)/actions";

const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "Students", icon: "users" },
  { href: "/coach/library", label: "Video lessons", icon: "lib" },
  { href: "/coach/bridge", label: "KIT bridge", icon: "radar" },
];
const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "Home", icon: "home" },
  { href: "/student/numbers", label: "My numbers", icon: "chart" },
  { href: "/student/swings", label: "My swings", icon: "cam" },
  { href: "/student/lessons", label: "Lessons", icon: "lib" },
];

export function AppShell({ role, name, children }: { role: "coach" | "student"; name: string; children: React.ReactNode }) {
  const nav = role === "coach" ? COACH_NAV : STUDENT_NAV;
  return (
    <div className="flex min-h-full">
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-line bg-surface p-4 sticky top-0 h-screen">
        <Link href={nav[0]!.href} className="flex items-center gap-2.5 px-2 pb-6">
          <span className="w-7 h-7 rounded-md bg-accent text-accent-ink grid place-items-center font-display font-bold">J</span>
          <span>
            <span className="block font-display font-bold text-lg leading-none">Coach Jay</span>
            <span className="eyebrow">Back Nine · N. Arlington</span>
          </span>
        </Link>
        <NavLinks items={nav} variant="side" />
        <div className="mt-auto flex flex-col gap-2 px-2 text-sm">
          <span className="text-ink2 truncate">{name}</span>
          <form action={signOut}><button className="text-ink3 hover:text-ink">Sign out</button></form>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-6 pb-24 md:pb-10 flex flex-col gap-5">{children}</main>
        <nav className="md:hidden fixed inset-x-0 bottom-0 z-10 bg-surface border-t border-line flex px-2 pt-1.5" style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}>
          <NavLinks items={nav} variant="tab" />
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, eyebrow, back, action }: { title: string; eyebrow?: string; back?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3">
      {back && (
        <Link href={back} aria-label="Back" className="w-9 h-9 -ml-2 grid place-items-center rounded-lg text-ink2 hover:bg-surface2">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
      )}
      <div className="flex-1 min-w-0">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="text-2xl md:text-3xl font-bold truncate">{title}</h1>
      </div>
      {action}
    </header>
  );
}
