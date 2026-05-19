import { db } from "./db";
import { logger } from "./logger";

export type QueueJobType = "publish" | "ai" | "webhook_retry";

export async function enqueueScheduledPost(postId: string) {
  logger.info("enqueue_scheduled_post", { postId });
  await db.scheduledPost.update({
    where: { id: postId },
    data: { status: "queued" },
  });
}

export async function markWebhookForRetry(eventId: string, error: string) {
  await db.stripeEvent.update({
    where: { eventId },
    data: {
      processingStatus: "failed",
      errorMessage: error,
    },
  });
}
