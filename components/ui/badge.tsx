import { cn } from "@/lib/helpers";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const statusTone: Record<string, Tone> = {
  active: "success",
  published: "success",
  pass: "success",
  trialing: "success",
  caption: "success",
  feature: "success",
  image_prompt: "success",
  thread: "success",
  audio_idea: "success",
  low: "success",

  draft: "warning",
  past_due: "warning",
  warn: "warning",
  medium: "warning",
  pending_payment: "warning",

  failed: "danger",
  canceled: "danger",
  trial_ended: "danger",
  fail: "danger",
  high: "danger",
  security: "danger",

  scheduled: "info",
  webhook_syncing: "info",
  video_idea: "info",
  improvement: "info",
  fix: "info",
};

const toneClasses: Record<Tone, string> = {
  success:
    "bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border border-[var(--color-success-border)]",
  warning:
    "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border border-[var(--color-warning-border)]",
  danger:
    "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border border-[var(--color-danger-border)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border border-[var(--color-info-border)]",
  neutral:
    "bg-[var(--color-neutral-bg)] text-[var(--color-neutral-fg)] border border-[var(--color-neutral-border)]",
};

export function Badge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = statusTone[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone],
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
