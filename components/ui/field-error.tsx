import { cn } from "@/lib/helpers";
import { HTMLAttributes } from "react";

/**
 * Inline field error message. Wire with Input/Textarea via
 * `aria-describedby` pointing at this element's id.
 */
export function FieldError({
  id,
  message,
  className,
  ...props
}: {
  id?: string;
  message?: string;
} & HTMLAttributes<HTMLParagraphElement>) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "mt-1 text-xs text-[var(--color-danger-fg)]",
        className
      )}
      {...props}
    >
      {message}
    </p>
  );
}
