import type { ReactNode } from "react";

/** Empty list: what belongs here, an example, and an action (spec §5.3). */
export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
