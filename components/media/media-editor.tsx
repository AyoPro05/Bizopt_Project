"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FallbackImage } from "@/components/ui/fallback-image";
import { Scissors, Crop } from "lucide-react";

type Asset = {
  id: string;
  url: string;
  type: string;
  filename?: string | null;
  durationMs?: number | null;
};

type Edit = {
  id: string;
  operation: string;
  version: number;
  createdAt: string;
};

type Props = {
  asset: Asset;
  initialEdits?: Edit[];
};

export function MediaEditor({ asset, initialEdits = [] }: Props) {
  const [edits, setEdits] = useState(initialEdits);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(asset.durationMs ?? 30000);
  const [cropW, setCropW] = useState(1080);
  const [cropH, setCropH] = useState(1080);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastOperation, setLastOperation] = useState<"trim" | "crop" | null>(null);

  async function saveEdit(operation: "trim" | "crop", params: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    setLastOperation(operation);
    const res = await fetch(`/api/media/${asset.id}/edits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, params }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Edit failed" });
      return;
    }
    setEdits((prev) => [data.edit, ...prev]);
    setMessage({ type: "success", text: `${operation} saved (v${data.edit.version})` });
  }

  async function retryLastEdit() {
    if (lastOperation === "trim") {
      await saveEdit("trim", { startMs, endMs });
      return;
    }
    if (lastOperation === "crop") {
      await saveEdit("crop", { width: cropW, height: cropH, x: 0, y: 0 });
    }
  }

  const isVisual = asset.type === "image" || asset.type === "video";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden p-0">
        {isVisual ? (
          asset.type === "video" ? (
            <video src={asset.url} controls className="aspect-video w-full bg-black" />
          ) : (
            <FallbackImage
              src={asset.url}
              alt={asset.filename ?? "Media"}
              className="w-full object-cover"
            />
          )
        ) : (
          <div className="flex aspect-video items-center justify-center bg-[var(--color-surface)]">
            <p className="text-sm text-[var(--color-ink-muted)]">Audio preview</p>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <h3 className="flex items-center gap-2 font-medium">
            <Scissors className="h-4 w-4 text-[var(--color-accent)]" />
            Trim
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">Set in/out points (milliseconds)</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm">
              Start
              <input
                type="number"
                value={startMs}
                onChange={(e) => setStartMs(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              End
              <input
                type="number"
                value={endMs}
                onChange={(e) => setEndMs(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <Button
            className="mt-4"
            disabled={saving}
            onClick={() => saveEdit("trim", { startMs, endMs })}
          >
            {saving ? "Saving..." : "Apply trim"}
          </Button>
        </Card>

        {asset.type === "image" && (
          <Card>
            <h3 className="flex items-center gap-2 font-medium">
              <Crop className="h-4 w-4 text-[var(--color-accent)]" />
              Crop
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm">
                Width
                <input
                  type="number"
                  value={cropW}
                  onChange={(e) => setCropW(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                Height
                <input
                  type="number"
                  value={cropH}
                  onChange={(e) => setCropH(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
            </div>
            <Button
              className="mt-4"
              disabled={saving}
              onClick={() => saveEdit("crop", { width: cropW, height: cropH, x: 0, y: 0 })}
            >
              {saving ? "Saving..." : "Apply crop"}
            </Button>
          </Card>
        )}

        {message && (
          <div
            className={
              message.type === "success"
                ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            }
          >
            <p>{message.text}</p>
            {message.type === "error" && (
              <button
                type="button"
                onClick={() => void retryLastEdit()}
                className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {edits.length > 0 && (
          <Card>
            <h3 className="font-medium">Edit history</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-ink-muted)]">
              {edits.map((e) => (
                <li key={e.id}>
                  v{e.version} · {e.operation}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
