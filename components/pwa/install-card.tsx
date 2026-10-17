"use client";

import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { installHint, type InstallHint } from "@/lib/pwa";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const noopSubscribe = () => () => {};

/** Device-based hint, read after hydration ("hidden" on the server) so markup never mismatches. */
function deviceHint(): InstallHint {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installHint(navigator.userAgent, standalone, navigator.maxTouchPoints);
}

/** Card on the Lainnya page that helps install the app; renders nothing once it runs as an installed app. */
export function InstallCard() {
  const t = useTranslations("Install");
  const deviceHintNow = useSyncExternalStore(noopSubscribe, deviceHint, () => "hidden" as InstallHint);
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const hint = installed ? "hidden" : deviceHintNow;

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hint === "hidden") return null;

  return (
    <section className="space-y-2 rounded-lg border p-4" aria-labelledby="install-title">
      <h2 id="install-title" className="font-medium">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      {hint === "ios" ? (
        <p className="flex items-start gap-2 text-sm">
          <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("iosSteps")}</span>
        </p>
      ) : (
        <>
          <Button
            type="button"
            disabled={!promptEvent}
            onClick={async () => {
              // The event works once: take it and clear it so the button disables until a new one arrives.
              const event = promptEvent;
              setPromptEvent(null);
              try {
                await event?.prompt();
                await event?.userChoice; // outcome ignored: `appinstalled` hides the card
              } catch {
                // prompt() already used or the browser refused; nothing to do
              }
            }}
          >
            <Download aria-hidden />
            {t("button")}
          </Button>
          {!promptEvent && <p className="text-xs text-muted-foreground">{t("unsupported")}</p>}
        </>
      )}
    </section>
  );
}
