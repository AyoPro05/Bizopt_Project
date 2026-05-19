import { cn } from "@/lib/helpers";
import { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
