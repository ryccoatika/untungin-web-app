/**
 * Holds the Chromium `beforeinstallprompt` event. The browser fires it once per document load, usually before the
 * user reaches the Lainnya page by client navigation, so listening starts at app load, not in the install card.
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallSnapshot = { event: InstallPromptEvent | null; installed: boolean };

let snapshot: InstallSnapshot = { event: null, installed: false };
const serverSnapshot: InstallSnapshot = snapshot;
const listeners = new Set<() => void>();
let started = false;

function set(next: InstallSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Adds the window listeners once; safe to call again. */
export function startInstallPromptCapture(target: Window = window) {
  if (started) return;
  started = true;
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    set({ ...snapshot, event: event as InstallPromptEvent });
  });
  target.addEventListener("appinstalled", () => set({ event: null, installed: true }));
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): InstallSnapshot {
  return snapshot;
}

export function getServerSnapshot(): InstallSnapshot {
  return serverSnapshot;
}

/** Returns the saved prompt event and clears it: the browser allows one `prompt()` per event. */
export function takeInstallPrompt(): InstallPromptEvent | null {
  const event = snapshot.event;
  if (event) set({ ...snapshot, event: null });
  return event;
}
