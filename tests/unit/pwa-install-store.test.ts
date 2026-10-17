import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: Event) => void;

function fakeWindow() {
  const listeners = new Map<string, Listener[]>();
  return {
    addEventListener: vi.fn((type: string, fn: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), fn])),
    dispatch(type: string, event: object = {}) {
      for (const fn of listeners.get(type) ?? []) fn(event as Event);
    },
    count: (type: string) => listeners.get(type)?.length ?? 0,
  };
}

describe("pwa install store", () => {
  beforeEach(() => vi.resetModules());

  it("captures the prompt event, prevents the default and hands it out once", async () => {
    const store = await import("@/lib/pwa-install-store");
    const win = fakeWindow();
    store.startInstallPromptCapture(win as unknown as Window);
    store.startInstallPromptCapture(win as unknown as Window); // idempotent
    expect(win.count("beforeinstallprompt")).toBe(1);
    expect(store.getSnapshot().event).toBeNull();

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const event = { preventDefault: vi.fn() };
    win.dispatch("beforeinstallprompt", event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(store.getSnapshot().event).toBe(event);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(store.takeInstallPrompt()).toBe(event);
    expect(store.getSnapshot().event).toBeNull();
    expect(store.takeInstallPrompt()).toBeNull();
    unsubscribe();
  });

  it("marks the app installed and drops the event on appinstalled", async () => {
    const store = await import("@/lib/pwa-install-store");
    const win = fakeWindow();
    store.startInstallPromptCapture(win as unknown as Window);
    win.dispatch("beforeinstallprompt", { preventDefault: vi.fn() });
    win.dispatch("appinstalled");
    expect(store.getSnapshot()).toEqual({ event: null, installed: true });
  });
});
