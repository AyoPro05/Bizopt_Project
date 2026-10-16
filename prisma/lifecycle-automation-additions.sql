-- Apply once after platform-experience-additions.sql. No production migration is run by application startup.
BEGIN;
-- CreateEnum
CREATE TYPE "IdentityTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SECURITY', 'BILLING', 'OPERATIONAL', 'DIGEST', 'MARKETING');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "checkoutConsentId" TEXT,
ADD COLUMN     "firstRecurringInvoiceId" TEXT,
ADD COLUMN     "introductoryInvoiceId" TEXT,
ADD COLUMN     "introductoryPaidAt" TIMESTAMP(3),
ADD COLUMN     "lastReconciledAt" TIMESTAMP(3),
ADD COLUMN     "lastReconciliationAttemptAt" TIMESTAMP(3),
ADD COLUMN     "paidThrough" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "hostedInvoiceUrl" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "servicePeriodEnd" TIMESTAMP(3),
ADD COLUMN     "servicePeriodStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IdentityToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "IdentityTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "dedupeKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "recipientEmail" TEXT,
    "secretPayloadEnc" TEXT,
    "secretExpiresAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "dedupeKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "recipientEmail" TEXT,
    "secretPayloadEnc" TEXT,
    "secretExpiresAt" TIMESTAMP(3),
    "providerPayloadEnc" TEXT,
    "providerPayloadExpiresAt" TIMESTAMP(3),
    "firstAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "providerStatusAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAttempt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRequestId" TEXT,
    "outcome" TEXT NOT NULL,
    "sanitizedErrorCode" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "digestFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "emailHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("emailHash")
);

-- CreateTable
CREATE TABLE "CommercialConsent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkoutIntentId" TEXT NOT NULL,
    "providerCheckoutId" TEXT,
    "offerVersion" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "introductoryAmountMinor" INTEGER NOT NULL,
    "introductoryDurationDays" INTEGER NOT NULL,
    "recurringAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "renewalDisclosureVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityRateLimit" (
    "key" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DataExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceTicketId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "payloadEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityToken_tokenHash_key" ON "IdentityToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IdentityToken_userId_purpose_consumedAt_idx" ON "IdentityToken"("userId", "purpose", "consumedAt");

-- CreateIndex
CREATE INDEX "IdentityToken_expiresAt_idx" ON "IdentityToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_processingStatus_availableAt_idx" ON "OutboxEvent"("processingStatus", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_orgId_createdAt_idx" ON "OutboxEvent"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_id_userId_key" ON "OutboxEvent"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_providerMessageId_key" ON "Notification"("providerMessageId");

-- CreateIndex
CREATE INDEX "Notification_userId_orgId_channel_createdAt_idx" ON "Notification"("userId", "orgId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_channel_scheduledAt_idx" ON "Notification"("status", "channel", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAttempt_notificationId_attemptNumber_key" ON "NotificationAttempt"("notificationId", "attemptNumber");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_status_receivedAt_idx" ON "ProviderWebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_providerEventId_key" ON "ProviderWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_category_key" ON "NotificationPreference"("userId", "channel", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialConsent_checkoutIntentId_key" ON "CommercialConsent"("checkoutIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialConsent_providerCheckoutId_key" ON "CommercialConsent"("providerCheckoutId");

-- CreateIndex
CREATE INDEX "CommercialConsent_orgId_acceptedAt_idx" ON "CommercialConsent"("orgId", "acceptedAt");

-- CreateIndex
CREATE INDEX "DataExportJob_sourceTicketId_idx" ON "DataExportJob"("sourceTicketId");

-- CreateIndex
CREATE INDEX "DataExportJob_status_availableAt_idx" ON "DataExportJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "DataExportJob_userId_orgId_expiresAt_idx" ON "DataExportJob"("userId", "orgId", "expiresAt");

-- AddForeignKey
ALTER TABLE "IdentityToken" ADD CONSTRAINT "IdentityToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_outboxEventId_userId_fkey" FOREIGN KEY ("outboxEventId", "userId") REFERENCES "OutboxEvent"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialConsent" ADD CONSTRAINT "CommercialConsent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialConsent" ADD CONSTRAINT "CommercialConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_sourceTicketId_orgId_fkey" FOREIGN KEY ("sourceTicketId", "orgId") REFERENCES "SupportTicket"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant association in addition to the identity-bound Prisma relation.
CREATE UNIQUE INDEX "OutboxEvent_id_orgId_key" ON "OutboxEvent" ("id", "orgId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_event_tenant_fkey" FOREIGN KEY ("outboxEventId", "orgId") REFERENCES "OutboxEvent" ("id", "orgId") ON DELETE CASCADE;
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_attempt_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempt_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "CommercialConsent" ADD CONSTRAINT "CommercialConsent_positive_terms" CHECK ("introductoryAmountMinor" >= 0 AND "recurringAmountMinor" > 0 AND "introductoryDurationDays" > 0);
CREATE INDEX "Subscription_reconciliation_attempt_idx" ON "Subscription" ("lastReconciliationAttemptAt") WHERE "stripeSubscriptionId" IS NOT NULL;
ALTER TABLE "IdentityToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdentityRateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboxEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProviderWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailSuppression" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommercialConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataExportJob" ENABLE ROW LEVEL SECURITY;
-- No browser policies. The existing server table-owner/BYPASSRLS role is required.
COMMIT;
