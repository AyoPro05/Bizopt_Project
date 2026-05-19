"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlatformSelector } from "@/components/campaigns/platform-selector";

export default function NewCampaignPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "linkedin"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
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
    router.push(`/campaigns/${data.campaign.id}/builder`);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">New campaign</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Post to multiple accounts at once — no clipboard workflow
      </p>

      <Card className="mt-8 max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Platforms</label>
            <PlatformSelector value={platforms} onChange={setPlatforms} />
          </div>
          <div>
            <label className="text-sm font-medium">Schedule (optional)</label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || platforms.length === 0}>
            {loading ? "Creating…" : "Create campaign"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
