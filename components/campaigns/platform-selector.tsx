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

  useEffect(() => {
    fetch("/api/platforms/registry")
      .then((r) => r.json())
      .then((d) => setPlatforms(d.platforms ?? []))
      .catch(() => setPlatforms([]));
  }, []);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  if (platforms.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">Loading platforms…</p>
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
