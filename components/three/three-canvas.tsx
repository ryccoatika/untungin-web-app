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
  /** Called once on mount; rebuild the scene with new data only by remounting with a `key`. */
  create: () => SceneController;
  className?: string;
  interactive?: boolean;
  onDone?: () => void;
  /** WebGL failed (context creation, scene creation or loss): the parent should show its static version. */
  onFail?: () => void;
} & ({ decorative: true; label?: never } | { decorative?: false; label: string });

export function ThreeCanvas({ create, className, label, decorative, interactive, onDone, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
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
    let controller: SceneController;
    try {
      controller = callbacks.current.create();
    } catch {
      renderer.dispose();
      renderer.forceContextLoss();
      callbacks.current.onFail?.();
      return;
    }
    controllerRef.current = controller;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    const canvas = renderer.domElement;
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
    host.appendChild(canvas);

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
      renderer.setSize(width, height, false);
      controller.camera.aspect = width / height;
      controller.camera.updateProjectionMatrix();
      controller.resize?.(width, height);
      // setSize clears the drawing buffer; redraw so a stopped loop does not leave a blank canvas.
      renderer.render(scene, controller.camera);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver((entries) => loop.setVisible(entries[entries.length - 1].isIntersecting));
    intersectionObserver.observe(host);
    const onVisibility = () => loop.setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    const onContextLost = (event: Event) => {
      event.preventDefault();
      loop.stop();
      callbacks.current.onFail?.();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    loop.start();

    return () => {
      loop.stop();
      controllerRef.current = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      scene.remove(controller.root);
      disposeObject(controller.root);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !interactive) return;
    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      controllerRef.current?.setPointer?.(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
    };
    const onPointerLeave = () => controllerRef.current?.setPointer?.(0, 0);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    return () => {
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
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
