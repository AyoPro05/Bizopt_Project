import { cn } from "@/lib/helpers";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, spellCheck, autoComplete, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      spellCheck={type === "password" ? false : spellCheck}
      autoComplete={autoComplete ?? (type === "password" ? "current-password" : undefined)}
      className={cn(
        "block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]",
        type === "password" && "font-mono tracking-wide",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
