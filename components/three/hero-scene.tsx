"use client";

import { useCallback } from "react";
import { createHeroScene } from "@/lib/three/scenes/hero";
import { ThreeCanvas } from "./three-canvas";
import { usePalette } from "./use-palette";

/** Decorative 3D hero; the page text carries the message. */
export default function HeroScene({ className, onFail }: { className?: string; onFail?: () => void }) {
  const palette = usePalette();
  const create = useCallback(() => createHeroScene(palette), [palette]);
  return <ThreeCanvas key={palette.bar} create={create} className={className} decorative interactive onFail={onFail} />;
}
