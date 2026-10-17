"use client";

import { useTheme } from "next-themes";
import { PALETTES, type Palette } from "@/lib/three/palette";

export function usePalette(): Palette {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? PALETTES.dark : PALETTES.light;
}
