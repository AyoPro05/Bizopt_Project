"use client";

import { useEffect, useState } from "react";

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
};

export function PlatformSelector({ value, onChange }: Props) {
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

  if (loading) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">Loading platform options...</p>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void loadPlatforms()}
          className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        No publishing platforms are available yet.
      </p>
    );
  }

  return (
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
                : "border border-[var(--color-border)] bg-white hover:bg-[var(--color-surface)]"
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
  );
}
