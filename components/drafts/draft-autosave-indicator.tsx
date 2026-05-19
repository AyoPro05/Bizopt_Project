"use client";

import { useDraftAutosave } from "@/hooks/use-draft-autosave";

export function DraftAutosaveIndicator() {
  const { status, lastSavedAt } = useDraftAutosave();

  if (status === "idle") return null;

  const label =
    status === "saving"
      ? "Saving draft…"
      : status === "error"
        ? "Save failed"
        : lastSavedAt
          ? `Saved ${lastSavedAt.toLocaleTimeString()}`
          : "Draft saved";

  return (
    <span
      className={`text-xs ${
        status === "error" ? "text-red-600" : "text-[var(--color-ink-muted)]"
      }`}
      role="status"
    >
      {label}
    </span>
  );
}
