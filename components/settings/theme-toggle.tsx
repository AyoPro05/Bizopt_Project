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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-[var(--color-ink)]">Appearance</p>
        <p className="text-sm text-[var(--color-ink-muted)]">Light, dark, or match your device</p>
      </div>
      <div className="flex rounded-xl border border-[var(--color-border)] p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
              theme === value
                ? "bg-[var(--color-accent)] text-white"
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
