"use client";

import { useCallback, useEffect, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useDraftAutosave(intervalMs = 15000) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const save = useCallback(async (payload: Record<string, unknown>) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/editor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: payload.entityType ?? "idea",
          snapshotJson: payload,
          briefId: payload.briefId as string | undefined,
          campaignId: payload.campaignId as string | undefined,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setStatus("error");
    }
  }, []);

  return { status, lastSavedAt, save };
}

export function useDraftAutosaveLoop(
  getSnapshot: () => Record<string, unknown> | null,
  enabled: boolean,
  intervalMs = 15000
) {
  const { save, status, lastSavedAt } = useDraftAutosave(intervalMs);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const snap = getSnapshot();
      if (snap) void save(snap);
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [enabled, getSnapshot, save, intervalMs]);

  return { status, lastSavedAt, save };
}
