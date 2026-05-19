"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/carousel`);
    const data = await res.json();
    if (res.ok) setSlides(data.slides);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addSlide() {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/carousel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: "" }),
    });
    setLoading(false);
    if (res.ok) await load();
  }

  async function removeSlide(slideId: string) {
    await fetch(`/api/campaigns/${campaignId}/carousel/${slideId}`, { method: "DELETE" });
    await load();
  }

  async function moveSlide(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= slides.length) return;
    const ordered = [...slides];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    const res = await fetch(`/api/campaigns/${campaignId}/carousel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((s) => s.id) }),
    });
    if (res.ok) {
      const data = await res.json();
      setSlides(data.slides);
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
        <Button type="button" variant="secondary" disabled={loading} onClick={addSlide}>
          <Plus className="mr-1 h-4 w-4" />
          Add slide
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {slides.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">No slides yet.</p>
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
