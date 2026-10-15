import * as Sentry from "@sentry/nextjs";
import { shouldDropIdentityTelemetry } from "@/lib/identity-privacy";
import { scrubMonitoringEvent } from "@/lib/monitoring-privacy";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => shouldDropIdentityTelemetry(event) ? null : scrubMonitoringEvent(event),
  beforeSendTransaction: (event) => shouldDropIdentityTelemetry(event) ? null : scrubMonitoringEvent(event),
});
