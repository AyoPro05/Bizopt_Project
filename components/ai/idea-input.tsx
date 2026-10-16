"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BILLING, PLATFORMS } from "@/lib/constants";

const STARTER_PROMPTS = [
  "Launching a spring offer — 20% off for engaged followers this week",
  "We're hiring a senior marketer — culture-first, remote-friendly team",
  "Customer win: how Acme Corp cut scheduling time by 40% with us",
];

const GOALS = [
  { value: "awareness", label: "Brand awareness" },
  { value: "leads", label: "Generate leads" },
  { value: "sales", label: "Drive sales" },
  { value: "hiring", label: "Hiring" },
  { value: "engagement", label: "Engagement" },
  { value: "launch", label: "Product launch" },
] as const;

type Props = {
  prompt: string;
  tone: string;
  goal: string;
  industry: string;
  audience: string;
  platforms: string[];
  loading: boolean;
  remainingFree?: number;
  onPromptChange: (v: string) => void;
  onToneChange: (v: string) => void;
  onGoalChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  onAudienceChange: (v: string) => void;
  onPlatformsChange: (v: string[]) => void;
  onGenerate: () => void;
};

export function IdeaInput({
  prompt,
  tone,
  goal,
  industry,
  audience,
  platforms,
  loading,
  remainingFree,
  onPromptChange,
  onToneChange,
  onGoalChange,
  onIndustryChange,
  onAudienceChange,
  onPlatformsChange,
  onGenerate,
}: Props) {
  function togglePlatform(p: string) {
    onPlatformsChange(
      platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]
    );
  }

  return (
    <div className="space-y-6">
      {typeof remainingFree === "number" && (
        <p className="rounded-xl bg-[var(--color-accent-soft)] px-4 py-2 text-sm text-[var(--color-accent-hover)]">
          {remainingFree} free idea{remainingFree === 1 ? "" : "s"} left — then start your{" "}
          {BILLING.trialDisplayPrice} trial
        </p>
      )}

      <div>
        <label className="text-sm font-medium">Quick starters</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPromptChange(s)}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-surface)]"
            >
              {s.slice(0, 42)}…
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="idea-prompt">Your business idea</Label>
        <Textarea
          id="idea-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={4}
          ariaLabel="Your business idea"
          placeholder="Launching a spring collection — 20% off for followers who engage this week…"
          className="mt-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="idea-goal">Post goal</Label>
          <select
            id="idea-goal"
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
          >
            <option value="">Select goal…</option>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="idea-tone">Tone</Label>
          <select
            id="idea-tone"
            value={tone}
            onChange={(e) => onToneChange(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="bold">Bold</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>
        <div>
          <Label htmlFor="idea-industry">Industry</Label>
          <Input
            id="idea-industry"
            value={industry}
            onChange={(e) => onIndustryChange(e.target.value)}
            placeholder="e.g. SaaS, retail, agency"
            ariaLabel="Industry"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="idea-audience">Audience</Label>
          <Input
            id="idea-audience"
            value={audience}
            onChange={(e) => onAudienceChange(e.target.value)}
            placeholder="e.g. small business owners"
            ariaLabel="Audience"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Platforms</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`rounded-full px-3 py-1 text-sm capitalize transition ${
                platforms.includes(p)
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onGenerate} disabled={loading || prompt.trim().length < 10}>
        {loading ? "Generating…" : "Generate content pack"}
      </Button>
    </div>
  );
}
