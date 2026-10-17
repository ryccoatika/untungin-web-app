"use client";

import { useEffect } from "react";
import { startInstallPromptCapture } from "@/lib/pwa-install-store";

// At module load, so the one-time install prompt is caught even before hydration finishes.
if (typeof window !== "undefined") startInstallPromptCapture();

/** Registers the offline-fallback service worker in production builds only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    startInstallPromptCapture();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => console.warn("Service worker registration failed:", error instanceof Error ? error.message : error));
  }, []);
  return null;
}
