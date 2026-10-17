"use client";

import { useCallback } from "react";
import { createCelebrationScene } from "@/lib/three/scenes/celebration";
import { ThreeCanvas } from "./three-canvas";
import { usePalette } from "./use-palette";

/** Full-screen coin burst over the page; never catches clicks; calls onDone when finished. */
export default function CelebrationBurst({ onDone }: { onDone: () => void }) {
  const palette = usePalette();
  const create = useCallback(() => createCelebrationScene(palette), [palette]);
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <ThreeCanvas create={create} decorative className="h-full w-full" onDone={onDone} onFail={onDone} />
    </div>
  );
}
