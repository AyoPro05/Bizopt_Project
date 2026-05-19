import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { listAssets } from "@/services/media/assets";
import { Card } from "@/components/ui/card";
import { AppTopbar } from "@/components/shell/app-topbar";
import { AssetsLibrary } from "@/components/assets/assets-library";

export default async function AssetsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const assets = await listAssets(org.id);

  return (
    <div>
      <AppTopbar title="Assets" />
      <h1 className="font-display text-3xl font-semibold">Media library</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Upload, trim, crop, and layer audio — stored on disk or S3-compatible storage
      </p>

      <Card className="mt-8 p-6">
        <AssetsLibrary
          initialAssets={assets.map((a) => ({
            id: a.id,
            type: a.type,
            url: a.url,
            filename: a.filename,
            mimeType: a.mimeType,
          }))}
        />
      </Card>
    </div>
  );
}
