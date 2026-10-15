-- Additive SEO migration for an existing BizOpt database. No existing rows are changed.
-- Apply once after backup; see docs/SEO_INTELLIGENCE.md for setup and rollback.
BEGIN;

-- CreateTable
CREATE TABLE "SeoSite" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "services" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorisedAt" TIMESTAMP(3),
    "authorisedBy" TEXT,
    "localChecklist" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoOpportunity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContentVersion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'template',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoAuditRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoAuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSearchImport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "searchType" TEXT NOT NULL DEFAULT 'web',
    "property" TEXT NOT NULL,
    "completeness" TEXT NOT NULL DEFAULT 'partial',
    "rows" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoSearchImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoSite_id_orgId_key" ON "SeoSite"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSite_orgId_url_key" ON "SeoSite"("orgId", "url");

-- CreateIndex
CREATE INDEX "SeoOpportunity_orgId_siteId_status_idx" ON "SeoOpportunity"("orgId", "siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SeoOpportunity_id_orgId_key" ON "SeoOpportunity"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoOpportunity_siteId_orgId_key_key" ON "SeoOpportunity"("siteId", "orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SeoContent_sessionId_key" ON "SeoContent"("sessionId");

-- CreateIndex
CREATE INDEX "SeoContent_orgId_siteId_idx" ON "SeoContent"("orgId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoContent_id_orgId_key" ON "SeoContent"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoContent_opportunityId_orgId_key" ON "SeoContent"("opportunityId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoContent_sessionId_orgId_key" ON "SeoContent"("sessionId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoContentVersion_contentId_orgId_version_key" ON "SeoContentVersion"("contentId", "orgId", "version");

-- CreateIndex
CREATE INDEX "SeoAuditRun_orgId_siteId_createdAt_idx" ON "SeoAuditRun"("orgId", "siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SeoAuditRun_status_nextAttemptAt_idx" ON "SeoAuditRun"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SeoSearchImport_orgId_siteId_createdAt_idx" ON "SeoSearchImport"("orgId", "siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EditorSession_id_orgId_key" ON "EditorSession"("id", "orgId");

-- AddForeignKey
ALTER TABLE "SeoSite" ADD CONSTRAINT "SeoSite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoOpportunity" ADD CONSTRAINT "SeoOpportunity_siteId_orgId_fkey" FOREIGN KEY ("siteId", "orgId") REFERENCES "SeoSite"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContent" ADD CONSTRAINT "SeoContent_siteId_orgId_fkey" FOREIGN KEY ("siteId", "orgId") REFERENCES "SeoSite"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContent" ADD CONSTRAINT "SeoContent_opportunityId_orgId_fkey" FOREIGN KEY ("opportunityId", "orgId") REFERENCES "SeoOpportunity"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContent" ADD CONSTRAINT "SeoContent_sessionId_orgId_fkey" FOREIGN KEY ("sessionId", "orgId") REFERENCES "EditorSession"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentVersion" ADD CONSTRAINT "SeoContentVersion_contentId_orgId_fkey" FOREIGN KEY ("contentId", "orgId") REFERENCES "SeoContent"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoAuditRun" ADD CONSTRAINT "SeoAuditRun_siteId_orgId_fkey" FOREIGN KEY ("siteId", "orgId") REFERENCES "SeoSite"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSearchImport" ADD CONSTRAINT "SeoSearchImport_siteId_orgId_fkey" FOREIGN KEY ("siteId", "orgId") REFERENCES "SeoSite"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Enforce one pending audit per tenant/site across concurrent workers and requests.
CREATE UNIQUE INDEX "SeoAuditRun_active_site_key" ON "SeoAuditRun" ("orgId", "siteId") WHERE "status" IN ('queued', 'running');

-- SEO is accessed only through authenticated server services. No browser REST policies.
-- The server database role must own these tables or have BYPASSRLS.
ALTER TABLE "SeoSite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoOpportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoContentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoAuditRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoSearchImport" ENABLE ROW LEVEL SECURITY;

COMMIT;
