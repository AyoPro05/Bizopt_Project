"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VariantItem } from "./content-gallery";

export function VariantDetail({
  variant,
  onUseInCampaign,
}: {
  variant: VariantItem | null;
  onUseInCampaign: () => void;
}) {
  if (!variant) {
    return (
      <Card className="text-sm text-[var(--color-ink-muted)]">
        Select a variant to preview and edit before scheduling.
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-medium">{variant.title ?? variant.type}</h3>
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm text-[var(--color-ink-muted)]">
        {variant.body}
      </pre>
      <div className="mt-6 flex gap-3">
        <Button onClick={onUseInCampaign}>Use in campaign</Button>
        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(variant.body)}>
          Copy
        </Button>
      </div>
    </Card>
  );
}
