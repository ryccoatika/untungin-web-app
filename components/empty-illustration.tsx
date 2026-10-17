"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRenderMode } from "@/components/three/use-render-mode";

const EmptyIllustration3D = dynamic(() => import("@/components/three/empty-illustration-3d"), {
  ssr: false,
  loading: () => <EmptyDrawing />,
});

/** For empty states on pages that may load Three.js (never on form pages, spec §7). */
export function EmptyIllustration() {
  const mode = useRenderMode();
  const [failed, setFailed] = useState(false);
  if (mode !== "3d" || failed) return <EmptyDrawing />;
  return <EmptyIllustration3D onFail={() => setFailed(true)} />;
}

function EmptyDrawing() {
  return (
    <svg viewBox="0 0 192 128" className="mx-auto h-32 w-48" aria-hidden data-testid="empty-drawing">
      <rect x="36" y="78" width="120" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="2" />
      <ellipse cx="96" cy="44" rx="18" ry="7" fill="#fcd34d" stroke="#f59e0b" strokeWidth="3" />
    </svg>
  );
}
