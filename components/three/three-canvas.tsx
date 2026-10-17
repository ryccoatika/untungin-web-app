"use client";

import { useEffect, useRef } from "react";
import { Scene, WebGLRenderer } from "three";
import { disposeObject } from "@/lib/three/dispose";
import { RenderLoop } from "@/lib/three/render-loop";
import type { SceneController } from "@/lib/three/scene";
import { cn } from "@/lib/utils";

/** Spec §7: never render above 2× device pixels. */
const MAX_PIXEL_RATIO = 2;

type Props = {
  /** Called once on mount; remount with a `key` to rebuild the scene with new data. */
  create: () => SceneController;
  className?: string;
  /** Accessible name; omit together with `decorative` for purely decorative scenes. */
  label?: string;
  decorative?: boolean;
  interactive?: boolean;
  onDone?: () => void;
  /** WebGL failed (context creation or loss): the parent should show its static version. */
  onFail?: () => void;
};

export function ThreeCanvas({ create, className, label, decorative, interactive, onDone, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ create, onDone, onFail });
  // Keep the latest callbacks without re-running the scene effect (declared first, so it runs first).
  useEffect(() => {
    callbacks.current = { create, onDone, onFail };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      callbacks.current.onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const controller = callbacks.current.create();
    const scene = new Scene();
    scene.add(controller.root);

    const loop = new RenderLoop((delta, elapsed) => {
      controller.update(delta, elapsed);
      renderer.render(scene, controller.camera);
      if (controller.done?.()) {
        loop.stop();
        callbacks.current.onDone?.();
      }
    });

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      controller.camera.aspect = width / height;
      controller.camera.updateProjectionMatrix();
      controller.resize?.(width, height);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(([entry]) => loop.setVisible(entry.isIntersecting));
    intersectionObserver.observe(host);
    const onVisibility = () => loop.setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      controller.setPointer?.(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
    };
    const onPointerLeave = () => controller.setPointer?.(0, 0);
    if (interactive) {
      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);
    }
    const onContextLost = (event: Event) => {
      event.preventDefault();
      loop.stop();
      callbacks.current.onFail?.();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    loop.start();

    return () => {
      loop.stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      scene.remove(controller.root);
      disposeObject(controller.root);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [interactive]);

  return (
    <div
      ref={hostRef}
      className={cn("relative overflow-hidden", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    />
  );
}
