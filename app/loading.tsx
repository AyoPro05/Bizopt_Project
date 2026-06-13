import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function RootLoading() {
  return (
    <div className="surface-page flex min-h-screen items-center justify-center">
      <div className="card-panel flex items-center gap-3 px-5 py-4">
        <LoadingSpinner size="md" />
        <p className="text-sm text-[var(--color-ink-muted)]">Loading workspace...</p>
      </div>
    </div>
  );
}
