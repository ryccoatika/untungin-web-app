export type InstallHint = "prompt" | "ios" | "hidden";

/** How the app can be installed on this device: Chromium prompt, iOS Share sheet, or not at all (already installed). */
export function installHint(ua: string, standalone: boolean): InstallHint {
  if (standalone) return "hidden";
  // iPadOS 13+ Safari reports a Mac UA in desktop mode; those with "Mobile" in the UA are covered here too.
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "prompt";
}
