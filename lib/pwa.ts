export type InstallHint = "prompt" | "ios" | "hidden";

/** How the app can be installed on this device: Chromium prompt, iOS Share sheet, or not at all (already installed). */
export function installHint(ua: string, standalone: boolean, maxTouchPoints = 0): InstallHint {
  if (standalone) return "hidden";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS in "desktop site" mode (the default on iPad) reports a Mac UA; a real Mac has no touch points.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  return "prompt";
}
