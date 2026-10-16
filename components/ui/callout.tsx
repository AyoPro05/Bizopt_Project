import { cn } from "@/lib/helpers";
import { ReactNode } from "react";
import { AlertCircle, Check, Info, Shield } from "lucide-react";

export type CalloutTone = "success" | "warning" | "danger" | "info" | "neutral";

interface CalloutProps {
  tone?: CalloutTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const toneClasses: Record<CalloutTone, string> = {
  success: "bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border-[var(--color-success-border)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border-[var(--color-warning-border)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border-[var(--color-danger-border)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border-[var(--color-info-border)]",
  neutral: "bg-[var(--color-neutral-bg)] text-[var(--color-neutral-fg)] border-[var(--color-neutral-border)]",
};

const icons: Record<CalloutTone, ReactNode> = {
  success: <Check className="h-5 w-5 flex-shrink-0" />,
  warning: <AlertCircle className="h-5 w-5 flex-shrink-0" />,
  danger: <AlertCircle className="h-5 w-5 flex-shrink-0" />,
  info: <Info className="h-5 w-5 flex-shrink-0" />,
  neutral: <Shield className="h-5 w-5 flex-shrink-0" />,
};

export function Callout({
  tone = "info",
  title,
  children,
  action,
  icon,
  className,
}: CalloutProps) {
  return (
    <div
      role="status"
      aria-live={tone === "danger" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        toneClasses[tone],
        className
      )}
    >
      <div className="mt-0.5" aria-hidden="true">
        {icon ?? icons[tone]}
      </div>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={cn("text-inherit", title && "mt-1")}>{children}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
