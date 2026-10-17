"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useRenderMode } from "@/components/three/use-render-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartSceneBar } from "@/lib/three/scenes/profit-chart";
import { cn } from "@/lib/utils";

const ProfitChart3D = dynamic(() => import("@/components/three/profit-chart-3d"), {
  ssr: false,
  // Same box as the 3D canvas, so the card does not collapse while three downloads.
  loading: () => <div className="h-72 w-full sm:h-80" aria-hidden />,
});

type View = "3d" | "2d";
const STORAGE_KEY = "untungin:chart-view";
const VIEW_EVENT = "untungin:chart-view";

function readView(): View {
  try {
    return localStorage.getItem(STORAGE_KEY) === "2d" ? "2d" : "3d";
  } catch {
    return "3d";
  }
}

function saveView(view: View) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VIEW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const STATUS_BAR: Record<ChartSceneBar["status"], string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

export type ProductChartBar = ChartSceneBar & { productId: string; fullValueLabel: string; statusLabel: string };

/** Product contribution chart (spec §5.2, §7): 3D with labels on capable devices, 2D otherwise or by choice. */
export function ProductChart({ bars }: { bars: ProductChartBar[] }) {
  const t = useTranslations("Visuals");
  const mode = useRenderMode();
  const savedView = useSyncExternalStore(subscribe, readView, () => "3d" as View);
  const [failed, setFailed] = useState(false);
  const canShow3d = mode === "3d" && !failed;
  const pending = mode === null; // server render and first paint: keep the 3D box's height so the page does not jump
  const view: View = canShow3d ? savedView : "2d";
  const listRef = useRef<HTMLUListElement>(null);
  const focusListNext = useRef(false);
  // After "+N more, see in 2D" the button is gone: move keyboard and screen-reader focus to the list.
  useEffect(() => {
    if (view === "2d" && focusListNext.current) {
      focusListNext.current = false;
      listRef.current?.focus();
    }
  }, [view]);
  const maxAbs = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>{t("chartTitle")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("chartHint")}</p>
        </div>
        {canShow3d && (
          <div role="group" aria-label={t("viewSwitch")} className="flex shrink-0 rounded-lg border p-0.5">
            {(["3d", "2d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => saveView(option)}
                className={cn(
                  "h-10 min-w-10 rounded-md px-3 text-sm font-medium",
                  view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t(option === "3d" ? "view3d" : "view2d")}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {pending ? (
          <div className="h-72 w-full sm:h-80" aria-hidden="true" />
        ) : view === "3d" ? (
          <ProfitChart3D
            bars={bars}
            label={t("chartLabel")}
            className="h-72 w-full sm:h-80"
            onFail={() => setFailed(true)}
            onShow2d={() => {
              focusListNext.current = true;
              saveView("2d");
            }}
          />
        ) : (
          // On a 3D-capable device the 2D list keeps the 3D box's height, so switching views does not jump the page.
          // A static device gets the list at its natural height: a min-height would leave a big empty card for one or two products.
          <ul ref={listRef} tabIndex={-1} className={cn("space-y-3 outline-none", canShow3d && "min-h-72 sm:min-h-80")} data-testid="chart-2d">
            {bars.map((bar) => (
              <li key={bar.productId} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{bar.name}</span>
                  <span className={cn("shrink-0 whitespace-nowrap tabular-nums", bar.value < 0 && "text-destructive")}>
                    {bar.fullValueLabel}
                  </span>
                </div>
                <div className="flex h-3 items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", STATUS_BAR[bar.status])}
                      style={{ width: `${Math.max((Math.abs(bar.value) / maxAbs) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="sr-only">{bar.statusLabel}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
