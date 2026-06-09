"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type ThemeSetting } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const options: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid gap-4">
      <div className="space-y-1">
        <p className="font-medium text-[var(--color-ink)]">Appearance</p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Choose light, dark, or automatically match your device.
        </p>
      </div>
      <div className="inline-flex w-fit rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
              theme === value
                ? "bg-[var(--color-card)] text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
