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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/media/${mediaAssetId}/audio-layers`);
    const data = await res.json();
    if (res.ok) setLayers(data.layers);
  }, [mediaAssetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLayer() {
    if (!selectedAudio) return;
    setLoading(true);
    const res = await fetch(`/api/media/${mediaAssetId}/audio-layers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioAssetId: selectedAudio, startMs, volume }),
    });
    setLoading(false);
    if (res.ok) {
      setSelectedAudio("");
      await load();
    }
  }

  async function updateLayer(layerId: string, patch: Partial<{ volume: number; startMs: number }>) {
    await fetch(`/api/media/audio-layers/${layerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function removeLayer(layerId: string) {
    await fetch(`/api/media/audio-layers/${layerId}`, { method: "DELETE" });
    await load();
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

      {layers.length > 0 && (
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
          <Button type="button" disabled={loading || !selectedAudio} onClick={addLayer}>
            Add layer
          </Button>
        </div>
      )}
    </Card>
  );
}
