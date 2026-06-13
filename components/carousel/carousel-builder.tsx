"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Plus, GripVertical } from "lucide-react";
import { SlideEditor, type Slide } from "./slide-editor";

type AssetOption = { id: string; url: string; filename?: string | null; type: string };

type Props = {
  campaignId: string;
  assets: AssetOption[];
  supportsCarousel: boolean;
};

export function CarouselBuilder({ campaignId, assets, supportsCarousel }: Props) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingSlides(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/carousel`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load slides");
      setSlides(data.slides ?? []);
    } catch (err) {
      setSlides([]);
      setError(err instanceof Error ? err.message : "Unable to load slides");
    } finally {
      setLoadingSlides(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addSlide() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/carousel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: "" }),
    });
    setSaving(false);
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to add slide");
    }
  }

  async function removeSlide(slideId: string) {
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/carousel/${slideId}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to remove slide");
    }
  }

  async function moveSlide(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= slides.length) return;
    const ordered = [...slides];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/carousel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((s) => s.id) }),
    });
    if (res.ok) {
      const data = await res.json();
      setSlides(data.slides);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to reorder slides");
    }
  }

  if (!supportsCarousel) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Selected platforms do not support carousels. Add Instagram or Facebook to enable slides.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Carousel</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Reorder slides — publish as a single swipeable post
          </p>
        </div>
        <Button type="button" variant="secondary" disabled={saving || loadingSlides} onClick={addSlide}>
          <Plus className="mr-1 h-4 w-4" />
          Add slide
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loadingSlides ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Loading slides...</p>
        ) : slides.length === 0 ? (
          <EmptyState
            title="Create your first slide"
            description="Add media and captions to build a swipeable carousel for supported channels."
            action={
              <Button type="button" variant="secondary" onClick={addSlide} disabled={saving}>
                <Plus className="mr-1 h-4 w-4" />
                Add slide
              </Button>
            }
          />
        ) : (
          slides.map((slide, i) => (
            <div key={slide.id} className="relative">
              <div className="absolute -left-1 top-4 flex flex-col gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => moveSlide(i, -1)}
                  className="rounded p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] disabled:opacity-30"
                >
                  <GripVertical className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === slides.length - 1}
                  onClick={() => moveSlide(i, 1)}
                  className="rounded p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] disabled:opacity-30"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="pl-6">
                <SlideEditor
                  campaignId={campaignId}
                  slide={slide}
                  assets={assets}
                  onUpdated={load}
                />
                <button
                  type="button"
                  onClick={() => removeSlide(slide.id)}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Remove slide
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
