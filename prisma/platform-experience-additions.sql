-- Additive platform migration. Apply after seo-intelligence-additions.sql.
-- The Device uniqueness index changes for the approved per-person policy.
BEGIN;
-- DropIndex
DROP INDEX "Device_orgId_fingerprint_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeOrgId" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "localDraftRecovery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MobileSession" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "membershipVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastPlanEventAt" TIMESTAMP(3),
ADD COLUMN     "pendingPlan" TEXT,
ADD COLUMN     "pendingPlanEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "pendingUpgradeInvoiceId" TEXT,
ADD COLUMN     "requestedPlan" TEXT,
ADD COLUMN     "selectedPlan" TEXT NOT NULL DEFAULT 'base',
ADD COLUMN     "stripeScheduleId" TEXT;

-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "planKey" TEXT NOT NULL DEFAULT 'base',
ADD COLUMN     "seatLimit" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "StripeEvent" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Browser session',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteApproval" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "workspaceVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "approvalId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "generation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdBy" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlanChange" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetPlan" TEXT NOT NULL,
    "quote" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "prorationDate" INTEGER,
    "amountDueCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'quoted',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlanChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "reproducibility" TEXT,
    "diagnostics" JSONB,
    "diagnosticsConsent" BOOLEAN NOT NULL DEFAULT false,
    "isSecurity" BOOLEAN NOT NULL DEFAULT false,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'received',
    "assigneeId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportStaff" (
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totpSecretEnc" TEXT NOT NULL,
    "lastTotpCounter" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportStaff_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SupportAccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "webSessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebSession_userId_revokedAt_idx" ON "WebSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "InviteApproval_orgId_actorId_idx" ON "InviteApproval"("orgId", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_tokenHash_key" ON "WorkspaceInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_orgId_status_expiresAt_idx" ON "WorkspaceInvite"("orgId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_orgId_approvalId_idx" ON "WorkspaceInvite"("orgId", "approvalId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_deliveryStatus_nextAttemptAt_idx" ON "WorkspaceInvite"("deliveryStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BillingPlanChange_orgId_status_idx" ON "BillingPlanChange"("orgId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_orgId_userId_createdAt_idx" ON "SupportTicket"("orgId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_id_orgId_key" ON "SupportTicket"("id", "orgId");

-- CreateIndex
CREATE INDEX "SupportMessage_orgId_ticketId_createdAt_idx" ON "SupportMessage"("orgId", "ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportAccessGrant_tokenHash_key" ON "SupportAccessGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "SupportAccessGrant_userId_webSessionId_idx" ON "SupportAccessGrant"("userId", "webSessionId");

-- CreateIndex
CREATE INDEX "Device_orgId_fingerprint_idx" ON "Device"("orgId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Device_orgId_userId_fingerprint_key" ON "Device"("orgId", "userId", "fingerprint");

-- AddForeignKey
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteApproval" ADD CONSTRAINT "InviteApproval_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanChange" ADD CONSTRAINT "BillingPlanChange_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_orgId_fkey" FOREIGN KEY ("ticketId", "orgId") REFERENCES "SupportTicket"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportStaff" ADD CONSTRAINT "SupportStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing workspace devices belonged to the sole owner. Ambiguous multi-owner
-- records stay unassigned and require explicit device authorization; no rows are deleted.
UPDATE "Device" d SET "userId" = owners."userId"
FROM (SELECT "orgId", min("userId") AS "userId" FROM "OrgMember" WHERE role = 'owner' GROUP BY "orgId" HAVING count(*) = 1) owners
WHERE d."orgId" = owners."orgId" AND d."userId" IS NULL;

CREATE INDEX "StripeEvent_processingStatus_nextAttemptAt_idx" ON "StripeEvent" ("processingStatus", "nextAttemptAt");
ALTER TABLE "WebSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InviteApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingPlanChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportStaff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportAccessGrant" ENABLE ROW LEVEL SECURITY;
-- No browser-role policies. Services use the existing privileged server role;
-- every service must also enforce current membership and capability checks.
COMMIT;
