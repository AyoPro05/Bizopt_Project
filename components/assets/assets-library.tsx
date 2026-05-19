"use client";

import { useState } from "react";
import Link from "next/link";
import { MediaUploader } from "@/components/media/media-uploader";
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

  function iconFor(type: string) {
    if (type === "video") return Film;
    if (type === "audio") return Music;
    return ImageIcon;
  }

  return (
    <>
      <MediaUploader
        onUploaded={() => {
          void fetch("/api/media")
            .then((r) => r.json())
            .then((d) => {
              if (d.assets) setAssets(d.assets);
            });
        }}
      />

      {assets.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--color-ink-muted)]">
          Upload images, video, or audio to use in campaigns and carousels.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => {
            const Icon = iconFor(a.type);
            return (
              <li key={a.id} className="rounded-xl border p-4 transition hover:shadow-md">
                {a.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
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
