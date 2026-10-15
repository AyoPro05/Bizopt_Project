"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

export function RunPredictButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/predict", { method: "POST", body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Prediction failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={run} disabled={loading}>
        {loading ? "Predicting…" : "Run growth prediction"}
      </Button>
      {error && (
        <Callout tone="danger" title={error} className="mt-2">
          <Button size="sm" variant="secondary" onClick={run}>
            Retry
          </Button>
        </Callout>
      )}
    </div>
  );
}
