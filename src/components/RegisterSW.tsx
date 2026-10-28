"use client";
import { useEffect } from "react";

/** Registers the service worker that receives clips shared from the phone's gallery. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
