"use client";

import { useCallback } from "react";
import { createProfitChartScene, type ChartSceneBar } from "@/lib/three/scenes/profit-chart";
import { makeCanvasLabel } from "./canvas-label";
import { ThreeCanvas } from "./three-canvas";
import { usePalette } from "./use-palette";

export default function ProfitChart3D({
  bars,
  label,
  className,
  onFail,
}: {
  bars: ChartSceneBar[];
  label: string;
  className?: string;
  onFail?: () => void;
}) {
  const palette = usePalette();
  const create = useCallback(() => createProfitChartScene(bars, palette, makeCanvasLabel), [bars, palette]);
  // Remount on new data or theme so the scene is rebuilt from scratch.
  const key = `${palette.bar}:${bars.map((bar) => `${bar.name}=${bar.value}:${bar.status}`).join("|")}`;
  return <ThreeCanvas key={key} create={create} label={label} interactive className={className} onFail={onFail} />;
}
