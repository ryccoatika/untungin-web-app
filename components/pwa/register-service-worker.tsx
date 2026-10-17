"use client";

import { useEffect } from "react";

/** Registers the offline-fallback service worker in production builds only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => console.warn("Service worker registration failed:", error instanceof Error ? error.message : error));
  }, []);
  return null;
}
