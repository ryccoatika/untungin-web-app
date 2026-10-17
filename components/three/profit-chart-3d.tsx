"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createProfitChartScene, type ChartSceneBar } from "@/lib/three/scenes/profit-chart";
import { makeCanvasLabel } from "./canvas-label";
import { ThreeCanvas } from "./three-canvas";
import { usePalette } from "./use-palette";

/** Below this width eight bars with readable labels do not fit, so the 3D view shows the largest few. */
const NARROW_PX = 480;
const NARROW_MAX_BARS = 5;

export default function ProfitChart3D({
  bars,
  label,
  className,
  onFail,
  onShow2d,
}: {
  bars: ChartSceneBar[];
  label: string;
  className?: string;
  onFail?: () => void;
  onShow2d?: () => void;
}) {
  const t = useTranslations("Visuals");
  const palette = usePalette();
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setWidth(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const narrow = width !== null && width < NARROW_PX;
  const shown = useMemo(() => {
    if (!narrow || bars.length <= NARROW_MAX_BARS) return bars;
    const keep = new Set([...bars].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, NARROW_MAX_BARS));
    return bars.filter((bar) => keep.has(bar));
  }, [bars, narrow]);
  const hidden = bars.length - shown.length;

  const create = useCallback(() => createProfitChartScene(shown, palette, makeCanvasLabel), [shown, palette]);
  // Remount on new data, labels (language) or theme so the scene is rebuilt from scratch.
  const key = `${palette.bar}:${shown.map((bar) => `${bar.name}=${bar.value}:${bar.status}:${bar.valueLabel}`).join("|")}`;
  return (
    <div ref={hostRef}>
      {width === null ? (
        <div className={className} />
      ) : (
        <ThreeCanvas key={key} create={create} label={label} interactive className={className} onFail={onFail} />
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onShow2d}
          className="mt-2 h-10 w-full rounded-md text-sm font-medium text-muted-foreground underline underline-offset-4 hover:bg-muted"
        >
          {t("moreIn2d", { count: hidden })}
        </button>
      )}
    </div>
  );
}
