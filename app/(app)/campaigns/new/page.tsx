"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { PlatformSelector } from "@/components/campaigns/platform-selector";

function NewCampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "linkedin"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    caption?: string;
    platforms?: string;
    scheduledAt?: string;
  }>({});

  useEffect(() => {
    const c = searchParams.get("caption");
    const t = searchParams.get("title");
    if (c) setCaption(decodeURIComponent(c));
    if (t) setTitle(decodeURIComponent(t));
    else if (c && !t) setTitle("Campaign from AI Studio");
  }, [searchParams]);

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Campaign title is required.";
    if (caption.length > 5000) next.caption = "Caption is too long.";
    if (platforms.length === 0) next.platforms = "Select at least one platform.";
    if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) {
      next.scheduledAt = "Enter a valid date and time.";
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const nextFieldErrors = validate();
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          caption,
          platforms,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Failed to create campaign");
        return;
      }
      const fromBrief = searchParams.get("fromBrief");
      router.push(
        fromBrief
          ? `/campaigns/${data.campaign.id}/builder?fromBrief=${fromBrief}`
          : `/campaigns/${data.campaign.id}/builder`
      );
    } catch {
      setLoading(false);
      setError("Unable to create campaign right now. Please retry.");
    }
  }

  function updateField<K extends "title" | "caption" | "scheduledAt">(key: K, value: string) {
    if (key === "title") setTitle(value);
    if (key === "caption") setCaption(value);
    if (key === "scheduledAt") setScheduledAt(value);
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <Card className="mt-8 max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <Label htmlFor="campaign-title">Title</Label>
          <Input
            id="campaign-title"
            value={title}
            onChange={(e) => updateField("title", e.target.value)}
            required
            error={!!fieldErrors.title}
            ariaDescribedBy={fieldErrors.title ? "campaign-title-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.title && (
            <FieldError id="campaign-title-error" message={fieldErrors.title} />
          )}
        </div>
        <div>
          <Label htmlFor="campaign-caption">Caption</Label>
          <Textarea
            id="campaign-caption"
            value={caption}
            onChange={(e) => updateField("caption", e.target.value)}
            rows={5}
            ariaDescribedBy={fieldErrors.caption ? "campaign-caption-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.caption && (
            <FieldError id="campaign-caption-error" message={fieldErrors.caption} />
          )}
        </div>
        <div>
          <Label>Platforms</Label>
          <PlatformSelector
            value={platforms}
            onChange={(next) => {
              setPlatforms(next);
              setFieldErrors((prev) => ({ ...prev, platforms: undefined }));
            }}
            ariaDescribedBy={fieldErrors.platforms ? "campaign-platforms-error" : undefined}
          />
          {fieldErrors.platforms && (
            <FieldError id="campaign-platforms-error" message={fieldErrors.platforms} />
          )}
        </div>
        <div>
          <Label htmlFor="campaign-schedule">Schedule (optional)</Label>
          <Input
            id="campaign-schedule"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => updateField("scheduledAt", e.target.value)}
            error={!!fieldErrors.scheduledAt}
            ariaDescribedBy={fieldErrors.scheduledAt ? "campaign-schedule-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.scheduledAt && (
            <FieldError id="campaign-schedule-error" message={fieldErrors.scheduledAt} />
          )}
        </div>
        {error && <FieldError message={error} />}
        <Button type="submit" disabled={loading || platforms.length === 0}>
          {loading ? "Creating…" : "Create campaign"}
        </Button>
      </form>
    </Card>
  );
}

export default function NewCampaignPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">New campaign</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Post to multiple accounts at once — no clipboard workflow
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-[var(--color-ink-muted)]">Loading…</p>}>
        <NewCampaignForm />
      </Suspense>
    </div>
  );
}
