import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled like <Input>; native pickers work best on low-end phones. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base dark:bg-input/30 [@media(pointer:fine)]:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
