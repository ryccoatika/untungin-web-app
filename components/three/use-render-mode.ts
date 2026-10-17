"use client";

import { useSyncExternalStore } from "react";
import { chooseRenderMode, type RenderMode } from "@/lib/three/capability";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
let webglSupport: boolean | undefined;

export function hasWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): RenderMode {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return chooseRenderMode({
    reducedMotion: window.matchMedia(REDUCED_MOTION).matches,
    webgl: hasWebGL(),
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
  });
}

/** "3d" or "static" in the browser (follows reduced-motion changes live); null on the server. */
export function useRenderMode(): RenderMode | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
