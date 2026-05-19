import { cn } from "@/lib/helpers";

const styles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-sky-100 text-sky-800",
  published: "bg-teal-100 text-teal-800",
  failed: "bg-red-100 text-red-800",
  past_due: "bg-amber-100 text-amber-800",
  canceled: "bg-slate-100 text-slate-600",
  pending_payment: "bg-amber-50 text-amber-700",
  trialing: "bg-emerald-100 text-emerald-800",
  trial_ended: "bg-orange-100 text-orange-800",
  webhook_syncing: "bg-violet-100 text-violet-800",
  caption: "bg-teal-100 text-teal-800",
  carousel_outline: "bg-violet-100 text-violet-800",
  image_prompt: "bg-sky-100 text-sky-800",
  video_idea: "bg-pink-100 text-pink-800",
  audio_idea: "bg-amber-100 text-amber-800",
  thread: "bg-indigo-100 text-indigo-800",
  feature: "bg-teal-100 text-teal-800",
  improvement: "bg-sky-100 text-sky-800",
  fix: "bg-orange-100 text-orange-800",
  security: "bg-red-100 text-red-800",
};

export function Badge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-slate-100 text-slate-700",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
