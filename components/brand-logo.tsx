import { cn } from "@/lib/utils";

/** Untungin mark + wordmark. Keep the mark in sync with app/icon.svg (the favicon source). */
export function BrandLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", size === "sm" ? "text-base" : "text-lg", className)}>
      <BrandMark className={size === "sm" ? "size-7" : "size-8"} />
      <span>
        Untung<span className="text-emerald-600 dark:text-emerald-400">in</span>
      </span>
    </span>
  );
}

/** The app icon: a "U" whose right stroke rises into an arrow, starting from a coin. Decorative. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-[23%] bg-linear-to-br from-emerald-400 to-emerald-700 shadow-sm",
        className,
      )}
    >
      <span className="absolute inset-0 bg-linear-to-b from-white/28 to-transparent to-55%" />
      <svg viewBox="0 0 64 64" className="relative size-full">
        <g fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 19v14a11.5 11.5 0 0 0 23 0V17" />
          <path d="M31.5 25.5 40 17l8.5 8.5" />
        </g>
        <circle cx="17" cy="19" r="3.5" fill="#fde68a" />
      </svg>
    </span>
  );
}
