"use client";

import { useState } from "react";
import Link from "next/link";
import { MediaUploader } from "@/components/media/media-uploader";
import { EmptyState } from "@/components/empty-state";
import { FallbackImage } from "@/components/ui/fallback-image";
import { ImageIcon, Film, Music } from "lucide-react";

type Asset = {
  id: string;
  type: string;
  url: string;
  filename?: string | null;
  mimeType?: string | null;
};

type Props = {
  initialAssets: Asset[];
};

export function AssetsLibrary({ initialAssets }: Props) {
  const [assets, setAssets] = useState(initialAssets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function iconFor(type: string) {
    if (type === "video") return Film;
    if (type === "audio") return Music;
    return ImageIcon;
  }

  async function refreshAssets() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load assets");
      setAssets(data.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load assets");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <MediaUploader
        onUploaded={() => {
          void refreshAssets();
        }}
      />

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void refreshAssets()}
            className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-[var(--color-ink-muted)]">Loading assets...</p>
      ) : assets.length === 0 ? (
        <EmptyState
          title="Add your first media asset"
          description="Upload images, videos, or audio to use in campaigns, carousels, and editing workflows."
          icon={<ImageIcon className="h-7 w-7" />}
          action={
            <button
              type="button"
              onClick={() => void refreshAssets()}
              className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
            >
              Refresh library
            </button>
          }
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => {
            const Icon = iconFor(a.type);
            return (
              <li key={a.id} className="rounded-xl border p-4 transition hover:shadow-md">
                {a.type === "image" ? (
                  <FallbackImage
                    src={a.url}
                    alt={a.filename ?? "Asset image"}
                    className="mb-3 h-32 w-full rounded-lg object-cover"
                  />
                ) : (
                  <Icon className="mb-3 h-8 w-8 text-[var(--color-accent)]" />
                )}
                <p className="text-sm font-medium">{a.filename ?? a.type}</p>
                <p className="text-xs text-[var(--color-ink-muted)]">{a.mimeType}</p>
                <Link
                  href={`/assets/${a.id}/editor`}
                  className="mt-3 inline-block text-sm text-[var(--color-accent)] hover:underline"
                >
                  Open editor →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
