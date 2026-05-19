"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type VariantItem = {
  id: string;
  type: string;
  title: string | null;
  body: string;
  isSelected: boolean;
};

export function ContentGallery({
  variants,
  selectedId,
  onSelect,
}: {
  variants: VariantItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onSelect(v.id)}
          className="text-left"
        >
          <Card
            className={cn(
              "h-full transition hover:shadow-md",
              (selectedId === v.id || v.isSelected) &&
                "ring-2 ring-[var(--color-accent)]"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{v.title ?? v.type}</span>
              <Badge status={v.type.replace(/_/g, " ")} />
            </div>
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">
              {v.body}
            </p>
          </Card>
        </button>
      ))}
    </div>
  );
}
