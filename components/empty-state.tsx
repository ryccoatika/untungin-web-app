import type { ReactNode } from "react";

/** Empty list: what belongs here, an example, and an action (spec §5.3). `illustration` only on non-form pages (spec §7). */
export function EmptyState({
  title,
  body,
  illustration,
  children,
}: {
  title: string;
  body: string;
  illustration?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
      {illustration}
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
