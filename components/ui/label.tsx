import { cn } from "@/lib/helpers";
import { LabelHTMLAttributes, forwardRef } from "react";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-[var(--color-ink)]",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
);
Label.displayName = "Label";
