import { cn } from "@/lib/helpers";

export type SpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-3",
};

export function LoadingSpinner({
  size = "md",
  className,
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <div
        className={cn(
          "animate-spin-fast rounded-full border-[var(--color-border)] border-t-[var(--color-accent)]",
          sizeClasses[size]
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
