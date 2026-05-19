"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/shell/app-topbar";
import { IdeaInput } from "@/components/ai/idea-input";
import { ContentGallery, type VariantItem } from "@/components/ai/content-gallery";
import { VariantDetail } from "@/components/ai/variant-detail";
import { useDraftAutosaveLoop } from "@/hooks/use-draft-autosave";
import Link from "next/link";

export function AiStudioView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const briefParam = searchParams.get("brief");

  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [goal, setGoal] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["linkedin", "instagram"]);
  const [loading, setLoading] = useState(false);
  const [briefId, setBriefId] = useState<string | null>(briefParam);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [remainingFree, setRemainingFree] = useState<number | undefined>(undefined);

  const loadBrief = useCallback(async (id: string) => {
    const res = await fetch(`/api/ai/briefs?id=${id}`);
    const data = await res.json();
    if (data.brief) {
      setPrompt(data.brief.prompt);
      setTone(data.brief.tone ?? "professional");
      const g = data.brief.goals as {
        goal?: string;
        industry?: string;
        audience?: string;
        platforms?: string[];
      } | null;
      if (g?.goal) setGoal(g.goal);
      if (g?.industry) setIndustry(g.industry);
      if (g?.audience) setAudience(g.audience);
      if (g?.platforms?.length) setPlatforms(g.platforms);
      setBriefId(data.brief.id);
      const v = data.brief.variants.map(
        (x: { id: string; type: string; title: string | null; body: string; isSelected: boolean }) => ({
          id: x.id,
          type: x.type,
          title: x.title,
          body: x.body,
          isSelected: x.isSelected,
        })
      );
      setVariants(v);
      const sel = v.find((x: VariantItem) => x.isSelected) ?? v[0];
      setSelectedId(sel?.id ?? null);
    }
  }, []);

  useEffect(() => {
    if (briefParam) void loadBrief(briefParam);
  }, [briefParam, loadBrief]);

  useEffect(() => {
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((d) => {
        if (!d.paid && typeof d.remainingFree === "number") {
          setRemainingFree(d.remainingFree);
        }
      })
      .catch(() => undefined);
  }, []);

  useDraftAutosaveLoop(
    () =>
      briefId
        ? { entityType: "idea", briefId, prompt, tone, goal, industry, audience, platforms, selectedId }
        : null,
    !!briefId && prompt.length > 0
  );

  async function generate() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        tone,
        goal: goal || undefined,
        industry: industry || undefined,
        audience: audience || undefined,
        platforms: platforms.length ? platforms : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Generation failed");
      if (res.status === 402) {
        setError(
          (typeof data.error === "string" ? data.error : "Trial required") +
            " — " +
            (data.remainingFree === 0 ? "Start your trial on Billing." : "")
        );
      }
      return;
    }
    if (typeof data.remainingFree === "number") setRemainingFree(data.remainingFree);
    setBriefId(data.brief.id);
    const v = data.variants.map(
      (x: { id: string; type: string; title: string | null; body: string; isSelected: boolean }) => ({
        id: x.id,
        type: x.type,
        title: x.title,
        body: x.body,
        isSelected: x.isSelected,
      })
    );
    setVariants(v);
    setSelectedId(v[0]?.id ?? null);
    router.replace(`/ai-studio?brief=${data.brief.id}`);
  }

  async function selectVariant(id: string) {
    setSelectedId(id);
    await fetch(`/api/ai/variants/${id}`, { method: "PATCH" });
    setVariants((prev) => prev.map((v) => ({ ...v, isSelected: v.id === id })));
  }

  const selected = variants.find((v) => v.id === selectedId) ?? null;

  return (
    <div>
      <AppTopbar title="AI Studio" />
      <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
        One business idea → captions, carousel, image & video prompts, audio concept, and thread.
      </p>

      <IdeaInput
        prompt={prompt}
        tone={tone}
        goal={goal}
        industry={industry}
        audience={audience}
        platforms={platforms}
        loading={loading}
        remainingFree={remainingFree}
        onPromptChange={setPrompt}
        onToneChange={setTone}
        onGoalChange={setGoal}
        onIndustryChange={setIndustry}
        onAudienceChange={setAudience}
        onPlatformsChange={setPlatforms}
        onGenerate={generate}
      />

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}{" "}
          {error.includes("trial") && (
            <Link href="/billing" className="font-medium underline">
              Go to billing
            </Link>
          )}
        </p>
      )}

      {variants.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Content gallery</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Select a variant to preview, copy, or send to a campaign
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <ContentGallery
              variants={variants}
              selectedId={selectedId}
              onSelect={selectVariant}
            />
            <VariantDetail
              variant={selected}
              onUseInCampaign={() => {
                const body = selected?.body ?? "";
                const params = new URLSearchParams({
                  caption: body.slice(0, 5000),
                  fromBrief: briefId ?? "",
                  title: prompt.slice(0, 80) || "Campaign from AI Studio",
                });
                router.push(`/campaigns/new?${params.toString()}`);
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
