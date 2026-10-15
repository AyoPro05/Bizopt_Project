import { cn } from "@/lib/helpers";
import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, error = false, ariaLabel, ariaDescribedBy, disabled, ...props },
    ref
  ) => (
    <textarea
      ref={ref}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={error}
      className={cn(
        "block w-full rounded-lg border bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-ink)] shadow-[var(--shadow-card)] outline-none transition-all duration-200",
        error
          ? "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-2 focus:ring-[var(--color-danger-bg)]"
          : "border-[color-mix(in_srgb,var(--color-border-strong)_55%,transparent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]",
        disabled && "cursor-not-allowed bg-[var(--color-surface)] opacity-60",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
