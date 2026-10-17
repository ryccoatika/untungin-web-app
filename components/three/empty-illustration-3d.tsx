"use client";

import { useCallback } from "react";
import { createEmptyScene } from "@/lib/three/scenes/empty";
import { ThreeCanvas } from "./three-canvas";
import { usePalette } from "./use-palette";

export default function EmptyIllustration3D({ onFail }: { onFail?: () => void }) {
  const palette = usePalette();
  const create = useCallback(() => createEmptyScene(palette), [palette]);
  return <ThreeCanvas key={palette.bar} create={create} decorative className="mx-auto h-32 w-48" onFail={onFail} />;
}
