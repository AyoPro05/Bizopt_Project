import * as Sentry from "@sentry/nextjs";
import { isPrivateIdentityPath, shouldDropIdentityTelemetry } from "@/lib/identity-privacy";
import { scrubMonitoringEvent } from "@/lib/monitoring-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: typeof window === "undefined" || !isPrivateIdentityPath(window.location.pathname),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => isPrivateIdentityPath(window.location.pathname) || shouldDropIdentityTelemetry(event) ? null : scrubMonitoringEvent(event),
  beforeSendTransaction: (event) => isPrivateIdentityPath(window.location.pathname) || shouldDropIdentityTelemetry(event) ? null : scrubMonitoringEvent(event),
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = (...args: Parameters<typeof Sentry.captureRouterTransitionStart>) => {
  if (!isPrivateIdentityPath(window.location.pathname) && !isPrivateIdentityPath(args[0])) Sentry.captureRouterTransitionStart(...args);
};
