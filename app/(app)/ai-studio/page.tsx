import { Suspense } from "react";
import { AiStudioView } from "./ai-studio-view";

export default function AiStudioPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--color-ink-muted)]">Loading AI Studio…</p>}>
      <AiStudioView />
    </Suspense>
  );
}
