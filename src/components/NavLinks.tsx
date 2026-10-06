"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5c3 .2 5.5 2.3 5.5 5.5" /></>,
  lib: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" /></>,
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  chart: <path d="M4 20h16M6 16l4-5 3 3 5-7" />,
  cam: <><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 10l5-2.5v9L16 14z" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 12l6-6" /></>,
};

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" | "tab" }) {
  const path = usePathname();
  const isOn = (href: string, idx: number) => (idx === 0 ? path === href || path.startsWith(href + "/students") : path.startsWith(href));
  return (
    <>
      {items.map((it, i) => {
        const on = isOn(it.href, i);
        const cls = variant === "side"
          ? `flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-medium ${on ? "bg-accent-soft text-accent font-semibold" : "text-ink2 hover:bg-surface2"}`
          : `flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium rounded-lg ${on ? "text-accent" : "text-ink3"}`;
        return (
          <Link key={it.href} href={it.href} className={cls} aria-current={on ? "page" : undefined}>
            <svg viewBox="0 0 24 24" className={variant === "side" ? "w-[18px] h-[18px]" : "w-[22px] h-[22px]"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon]}</svg>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </>
  );
}
