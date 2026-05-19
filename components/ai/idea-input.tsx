"use client";

import { Button } from "@/components/ui/button";

type Props = {
  prompt: string;
  tone: string;
  loading: boolean;
  onPromptChange: (v: string) => void;
  onToneChange: (v: string) => void;
  onGenerate: () => void;
};

export function IdeaInput({
  prompt,
  tone,
  loading,
  onPromptChange,
  onToneChange,
  onGenerate,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Your idea</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={4}
          placeholder="Launching a spring collection — 20% off for followers who engage this week…"
          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm font-medium">Tone</label>
          <select
            value={tone}
            onChange={(e) => onToneChange(e.target.value)}
            className="mt-1 block rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="bold">Bold</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>
        <Button onClick={onGenerate} disabled={loading || prompt.trim().length < 10}>
          {loading ? "Generating…" : "Generate content pack"}
        </Button>
      </div>
    </div>
  );
}
