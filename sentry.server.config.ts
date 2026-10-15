import * as Sentry from "@sentry/nextjs";
import { scrubMonitoringEvent } from "@/lib/monitoring-privacy";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubMonitoringEvent,
  beforeSendTransaction: scrubMonitoringEvent,
});
