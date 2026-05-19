/**
 * Processes pending media edit jobs (trim/crop metadata).
 * Run: npm run worker:media
 */
import { db } from "../lib/db";

async function tick() {
  const pending = await db.mediaEdit.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  for (const edit of pending) {
    console.log(
      `[media-worker] asset=${edit.assetId} op=${edit.operation} v${edit.version}`
    );
  }
}

async function main() {
  console.log("Media worker started");
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
