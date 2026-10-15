"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import { CarouselBuilder } from "@/components/carousel/carousel-builder";
import { PlatformSelector } from "./platform-selector";

type Campaign = {
  id: string;
  title: string;
  caption?: string | null;
  platforms: string[];
  status: string;
};

type AssetOption = { id: string; url: string; filename?: string | null; type: string };

type Props = {
  campaign: Campaign;
  assets: AssetOption[];
};

export function CampaignBuilder({ campaign, assets }: Props) {
  const [title, setTitle] = useState(campaign.title);
  const [caption, setCaption] = useState(campaign.caption ?? "");
  const [platforms, setPlatforms] = useState(campaign.platforms);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supportsCarousel = platforms.some((p) =>
    ["instagram", "facebook"].includes(p)
  );

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, caption, platforms }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage({ type: "success", text: "Campaign saved." });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error ?? "Save failed. Please retry." });
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="font-medium">Campaign details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="campaign-title">Title</Label>
            <Input
              id="campaign-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="campaign-caption">Caption</Label>
            <Textarea
              id="campaign-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="mt-1"
            />
          </div>
          <div>
            <span className="text-sm font-medium text-[var(--color-ink)]">Platforms</span>
            <div className="mt-2">
              <PlatformSelector value={platforms} onChange={setPlatforms} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={saving || platforms.length === 0} onClick={save}>
              {saving ? "Saving…" : "Save campaign"}
            </Button>
            <Link
              href={`/assets`}
              className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--color-border-strong)_55%,transparent)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)] transition hover:bg-[var(--color-surface)]"
            >
              Open media library
            </Link>
          </div>
          {message && (
            <Callout
              tone={message.type === "success" ? "success" : "danger"}
              title={message.text}
            />
          )}
        </div>
      </Card>

      <CarouselBuilder
        campaignId={campaign.id}
        assets={assets}
        supportsCarousel={supportsCarousel}
      />
    </div>
  );
}
