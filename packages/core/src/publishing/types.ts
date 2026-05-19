export type PostStatus = "queued" | "publishing" | "published" | "failed" | "canceled";

export type ScheduledPostSnapshot = {
  id: string;
  platformKey: string;
  status: PostStatus;
  scheduledAt: string;
  publishedAt?: string;
  errorMessage?: string;
  retryCount: number;
};
