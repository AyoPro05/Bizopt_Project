"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2 } from "lucide-react";

type Layer = {
  id: string;
  startMs: number;
  volume: number;
  sortOrder: number;
  audioAsset: { id: string; filename?: string | null; url: string };
};

type AudioAsset = { id: string; filename?: string | null; type: string };

type Props = {
  mediaAssetId: string;
  audioAssets: AudioAsset[];
};

export function AudioLayerEditor({ mediaAssetId, audioAssets }: Props) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [volume] = useState(1);
  const [startMs, setStartMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingLayers, setLoadingLayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingLayers(true);
    setError(null);
    const res = await fetch(`/api/media/${mediaAssetId}/audio-layers`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setLayers(data.layers ?? []);
    else setError(data.error ?? "Unable to load audio layers");
    setLoadingLayers(false);
  }, [mediaAssetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLayer() {
    if (!selectedAudio) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/media/${mediaAssetId}/audio-layers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioAssetId: selectedAudio, startMs, volume }),
    });
    setSaving(false);
    if (res.ok) {
      setSelectedAudio("");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to add audio layer");
    }
  }

  async function updateLayer(layerId: string, patch: Partial<{ volume: number; startMs: number }>) {
    setError(null);
    const res = await fetch(`/api/media/audio-layers/${layerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to update layer");
    }
  }

  async function removeLayer(layerId: string) {
    setError(null);
    const res = await fetch(`/api/media/audio-layers/${layerId}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to remove layer");
    }
  }

  return (
    <Card>
      <h3 className="flex items-center gap-2 font-medium">
        <Volume2 className="h-4 w-4 text-[var(--color-accent)]" />
        Audio layers
      </h3>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Stack voiceovers or music on video — synced to your timeline
      </p>

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

      {loadingLayers ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">Loading audio layers...</p>
      ) : layers.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {layers.map((layer) => (
            <li
              key={layer.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
            >
              <span>{layer.audioAsset.filename ?? "Audio track"}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={layer.volume}
                  onChange={(e) =>
                    updateLayer(layer.id, { volume: Number(e.target.value) })
                  }
                  className="w-24"
                />
                <button
                  type="button"
                  onClick={() => removeLayer(layer.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
          No audio layers yet. Add a track to enrich this media asset.
        </p>
      )}

      {audioAssets.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          <select
            value={selectedAudio}
            onChange={(e) => setSelectedAudio(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select audio asset…</option>
            {audioAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.filename ?? a.id}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Start ms"
            value={startMs}
            onChange={(e) => setStartMs(Number(e.target.value))}
            className="w-28 rounded-lg border px-3 py-2 text-sm"
          />
          <Button type="button" disabled={saving || !selectedAudio} onClick={addLayer}>
            Add layer
          </Button>
        </div>
      )}
    </Card>
  );
}
