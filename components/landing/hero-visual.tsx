"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRenderMode } from "@/components/three/use-render-mode";
import { cn } from "@/lib/utils";

const HeroScene = dynamic(() => import("@/components/three/hero-scene"), { ssr: false, loading: () => <HeroPoster /> });

const BOX = "h-64 w-full sm:h-80";

/** 3D hero on capable devices; the same picture as a static drawing everywhere else (spec §7). */
export function HeroVisual() {
  const mode = useRenderMode();
  const [failed, setFailed] = useState(false);
  if (mode !== "3d" || failed) return <HeroPoster />;
  return <HeroScene className={BOX} onFail={() => setFailed(true)} />;
}

function HeroPoster() {
  const heights = [56, 92, 128, 176];
  return (
    <svg viewBox="0 0 320 240" className={cn(BOX, "text-emerald-600 dark:text-emerald-500")} aria-hidden data-testid="hero-poster">
      <rect x="40" y="206" width="240" height="10" rx="5" className="fill-muted" />
      {heights.map((height, i) => (
        <rect key={height} x={62 + i * 52} y={206 - height} width="40" height={height} rx="6" fill="currentColor" />
      ))}
      <ellipse cx="238" cy="20" rx="18" ry="7" fill="#fcd34d" stroke="#f59e0b" strokeWidth="3" />
      <ellipse cx="186" cy="58" rx="18" ry="7" fill="#fcd34d" stroke="#f59e0b" strokeWidth="3" />
    </svg>
  );
}
