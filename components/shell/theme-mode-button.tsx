"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeSetting } from "@/components/theme/theme-provider";
import { cn } from "@/lib/helpers";

const iconFor: Record<ThemeSetting, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const labelFor: Record<ThemeSetting, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const cycle: ThemeSetting[] = ["system", "light", "dark"];

/** Compact single-button theme toggle for the shell topbar. */
export function ThemeModeButton() {
  const { theme, resolved, setTheme } = useTheme();

  const next = cycle[(cycle.indexOf(theme) + 1) % cycle.length];
  const Icon = iconFor[theme];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Appearance: ${labelFor[theme]}. Click to switch to ${labelFor[next]}`}
      className={cn(
        "rounded-lg p-2 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
        resolved === "dark" && "text-[var(--color-ink-subtle)]"
      )}
      title={`Appearance: ${labelFor[theme]}. Click to switch to ${labelFor[next]}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
