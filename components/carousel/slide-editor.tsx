"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type Slide = {
  id: string;
  sortOrder: number;
  caption?: string | null;
  mediaAsset?: { id: string; url: string; filename?: string | null } | null;
};

type AssetOption = { id: string; url: string; filename?: string | null; type: string };

type Props = {
  campaignId: string;
  slide: Slide;
  assets: AssetOption[];
  onUpdated: () => void;
};

export function SlideEditor({ campaignId, slide, assets, onUpdated }: Props) {
  const [caption, setCaption] = useState(slide.caption ?? "");
  const [mediaAssetId, setMediaAssetId] = useState(slide.mediaAsset?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function saveSlide() {
    setSaving(true);
    const res = await fetch(`/api/campaigns/${campaignId}/carousel/${slide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: caption || undefined,
        mediaAssetId: mediaAssetId || null,
      }),
    });
    setSaving(false);
    if (res.ok) onUpdated();
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex gap-4">
        {slide.mediaAsset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.mediaAsset.url}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[var(--color-surface)] text-xs text-[var(--color-ink-muted)]">
            No media
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Slide caption…"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={mediaAssetId}
            onChange={(e) => setMediaAssetId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Attach image…</option>
            {assets
              .filter((a) => a.type === "image")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename ?? a.id}
                </option>
              ))}
          </select>
        </div>
      </div>
      <Button className="mt-3" variant="secondary" disabled={saving} onClick={saveSlide}>
        {saving ? "Saving…" : "Save slide"}
      </Button>
    </div>
  );
}
