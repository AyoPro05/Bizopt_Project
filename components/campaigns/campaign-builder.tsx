"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [message, setMessage] = useState("");

  const supportsCarousel = platforms.some((p) =>
    ["instagram", "facebook"].includes(p)
  );

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, caption, platforms }),
    });
    setSaving(false);
    if (res.ok) setMessage("Campaign saved");
    else setMessage("Save failed");
  }

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="font-medium">Campaign details</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            Caption
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm"
            />
          </label>
          <div>
            <span className="text-sm font-medium">Platforms</span>
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
              className="inline-flex items-center rounded-xl border px-4 py-2.5 text-sm hover:bg-[var(--color-surface)]"
            >
              Open media library
            </Link>
          </div>
          {message && <p className="text-sm text-emerald-600">{message}</p>}
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
