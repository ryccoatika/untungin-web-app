"use client";

import { useEffect } from "react";

/** The question to ask before leaving, while the sales entry has unsaved counts; null when there is nothing to lose. */
let question: string | null = null;

/** True when nothing unsaved is on screen, or the seller agreed to leave it. */
export function confirmLeave(): boolean {
  return question === null || window.confirm(question);
}

/**
 * While `active`, asks `text` before the page is closed or reloaded and before a link click leaves it. The browser's
 * back button is not covered: the App Router has no way to hold a history navigation.
 */
export function useLeaveGuard(active: boolean, text: string) {
  useEffect(() => {
    if (!active) return;
    question = text;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Capture phase on document runs before React's root listener, so a declined leave never reaches next/link.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      question = null;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, text]);
}
