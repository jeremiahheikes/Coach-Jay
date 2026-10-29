"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page's server data every `seconds` while it's visible, so a lesson page fills in on its own. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const h = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(h); document.removeEventListener("visibilitychange", tick); };
  }, [router, seconds]);
  return null;
}
