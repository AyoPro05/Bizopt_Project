import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getAsset } from "@/services/media/assets";
import { db } from "@/lib/db";
import { AppTopbar } from "@/components/shell/app-topbar";
import { MediaEditor } from "@/components/media/media-editor";
import { AudioLayerEditor } from "@/components/media/audio-layer-editor";

export default async function AssetEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const asset = await getAsset(org.id, id);
  if (!asset) notFound();

  const audioAssets = await db.asset.findMany({
    where: { orgId: org.id, type: "audio" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <AppTopbar title="Media editor" />
      <Link href="/assets" className="text-sm text-[var(--color-accent)] hover:underline">
        ← Assets
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold">
        {asset.filename ?? "Untitled media"}
      </h1>
      <p className="text-sm text-[var(--color-ink-muted)] capitalize">{asset.type} · trim, crop, layers</p>

      <div className="mt-8 space-y-8">
        <MediaEditor
          asset={{
            id: asset.id,
            url: asset.url,
            type: asset.type,
            filename: asset.filename,
            durationMs: asset.durationMs,
          }}
          initialEdits={asset.edits.map((e) => ({
            id: e.id,
            operation: e.operation,
            version: e.version,
            createdAt: e.createdAt.toISOString(),
          }))}
        />
        {(asset.type === "video" || asset.type === "image") && (
          <AudioLayerEditor
            mediaAssetId={asset.id}
            audioAssets={audioAssets.map((a) => ({
              id: a.id,
              filename: a.filename,
              type: a.type,
            }))}
          />
        )}
      </div>
    </div>
  );
}
