"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type PlatformEntry = {
  key: string;
  displayName: string;
  capabilities: {
    supportsCarousel: boolean;
  };
};

type Props = {
  value: string[];
  onChange: (keys: string[]) => void;
  ariaDescribedBy?: string;
};

export function PlatformSelector({ value, onChange, ariaDescribedBy }: Props) {
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPlatforms() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platforms/registry");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load platforms");
      setPlatforms(data.platforms ?? []);
    } catch (err) {
      setPlatforms([]);
      setError(err instanceof Error ? err.message : "Unable to load platforms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlatforms();
  }, []);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  return (
    <div
      role="group"
      aria-describedby={ariaDescribedBy}
      className="flex flex-col gap-2"
    >
      {loading && <p className="text-sm text-[var(--color-ink-muted)]">Loading platform options…</p>}

      {error && (
        <>
          <p className="text-sm text-[var(--color-danger-fg)]">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadPlatforms()}>
            Retry
          </Button>
        </>
      )}

      {!loading && !error && platforms.length === 0 && (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No publishing platforms are available yet.
        </p>
      )}

      {!loading && !error && platforms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => {
            const selected = value.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => toggle(p.key)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  selected
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-surface)]"
                }`}
              >
                {p.displayName}
                {p.capabilities.supportsCarousel && (
                  <span className="ml-1 opacity-70">· carousel</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
