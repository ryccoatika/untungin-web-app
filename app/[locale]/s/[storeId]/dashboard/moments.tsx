"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRenderMode } from "@/components/three/use-render-mode";
import { firstProfitKey, momentToShow, type Moment } from "@/lib/dashboard/moments";

const CelebrationBurst = dynamic(() => import("@/components/three/celebration-burst"), { ssr: false });

function wasCelebrated(storeId: string): boolean {
  try {
    return localStorage.getItem(firstProfitKey(storeId)) === "1";
  } catch {
    return true; // storage blocked: never risk celebrating on every visit
  }
}

function markCelebrated(storeId: string) {
  try {
    localStorage.setItem(firstProfitKey(storeId), "1");
  } catch {
    // Storage blocked: nothing to remember.
  }
}

/** Store-created and first-profit celebrations (spec §7): a dismissible message plus a 3D burst where allowed. */
export function Moments({ storeId, welcome, profitPositive }: { storeId: string; welcome: boolean; profitPositive: boolean }) {
  const t = useTranslations("Visuals");
  const mode = useRenderMode();
  const [moment, setMoment] = useState<Moment | null>(null);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const next = momentToShow({ welcome, profitPositive, profitCelebrated: wasCelebrated(storeId) });
    if (welcome) {
      // Drop ?welcome=1 so a reload or a shared link does not celebrate again.
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", url);
    }
    if (next === "firstProfit") markCelebrated(storeId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage once after mount
    setMoment(next);
    setBurst(next !== null);
  }, [storeId, welcome, profitPositive]);

  if (!moment) return null;
  return (
    <>
      <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
        <p className="flex-1 font-medium">{t(moment)}</p>
        <button
          type="button"
          onClick={() => setMoment(null)}
          aria-label={t("dismiss")}
          className="-m-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-emerald-500/15"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {burst && mode === "3d" && <CelebrationBurst onDone={() => setBurst(false)} />}
    </>
  );
}
