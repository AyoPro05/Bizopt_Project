/*
  BizOpt Phase 2.1: Workspace Session System
  
  This migration adds the core state model (WorkspaceSession) and enhances
  Growth/Compliance models to support explainable intelligence.
  
  New Models:
  - WorkspaceSession: Core state container for entire user journey
  - WorkspaceSnapshot: Point-in-time state capture for resumption
  - HomeDecisionCard: Pre-computed dashboard cards
  
  Modified Models:
  - ContentVariant: Added workspaceSessionId to link variants to sessions
  - GrowthPrediction: Added confidence, reason, recommendedAction, evidence for explainability
  - ComplianceCheck: Added explanation, recommendedFix, evidence for explainability
*/

-- WorkspaceSession: Core state container for entire content creation journey
-- Replaces scattered state across IdeaBrief → ContentVariant → Campaign → scheduling
CREATE TABLE "WorkspaceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    
    -- Journey stage
    "stage" TEXT NOT NULL DEFAULT 'idea',  -- idea | generate | compare | edit | schedule | publish | measure
    
    -- Idea phase: Raw input
    "ideaPrompt" TEXT NOT NULL,
    "businessGoal" TEXT,
    "tone" TEXT DEFAULT 'professional',
    "industry" TEXT,
    "audience" TEXT,
    "selectedPlatforms" TEXT NOT NULL DEFAULT '[]',  -- JSON array of platform keys
    
    -- Generation phase: AI output
    "generatedVariants" TEXT NOT NULL DEFAULT '[]',  -- JSON array of ContentVariant IDs
    "selectedVariantId" TEXT,                        -- Selected variant for further editing
    "compareViewOpen" BOOLEAN NOT NULL DEFAULT false,
    
    -- Edit phase: Media and carousel state
    "editingAssetIds" TEXT NOT NULL DEFAULT '[]',    -- JSON array of Asset IDs being edited
    "carouselState" JSONB,                          -- Slide order, per-slide captions
    
    -- Schedule phase: Publishing intent
    "scheduleIntent" TEXT,                          -- "now" or ISO datetime
    "scheduledPlatforms" TEXT NOT NULL DEFAULT '[]', -- JSON array of platforms to publish to
    
    -- Publish phase: Campaign tracking
    "campaignId" TEXT,
    "publishedAt" TIMESTAMP(3),
    
    -- Measure phase: Intelligence integration
    "growthPredictionId" TEXT,
    "growthSnapshotId" TEXT,
    "complianceCheckId" TEXT,
    
    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),  -- Auto-expire after 90 days
    
    CONSTRAINT "WorkspaceSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
    CONSTRAINT "WorkspaceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "WorkspaceSession_selectedVariantId_fkey" FOREIGN KEY ("selectedVariantId") REFERENCES "ContentVariant" ("id") ON DELETE SET NULL,
    CONSTRAINT "WorkspaceSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL,
    CONSTRAINT "WorkspaceSession_growthPredictionId_fkey" FOREIGN KEY ("growthPredictionId") REFERENCES "GrowthPrediction" ("id") ON DELETE SET NULL,
    CONSTRAINT "WorkspaceSession_complianceCheckId_fkey" FOREIGN KEY ("complianceCheckId") REFERENCES "ComplianceCheck" ("id") ON DELETE SET NULL
);

-- Indexes for common queries
CREATE UNIQUE INDEX "WorkspaceSession_orgId_id_key" ON "WorkspaceSession"("orgId", "id");
CREATE INDEX "WorkspaceSession_orgId_userId_idx" ON "WorkspaceSession"("orgId", "userId");
CREATE INDEX "WorkspaceSession_orgId_stage_idx" ON "WorkspaceSession"("orgId", "stage");
CREATE INDEX "WorkspaceSession_orgId_updatedAt_idx" ON "WorkspaceSession"("orgId", "updatedAt" DESC);

-- WorkspaceSnapshot: Point-in-time state capture
-- Used for: 1) Resuming workflows, 2) Undo/history, 3) Audit trail
CREATE TABLE "WorkspaceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceSessionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,                    -- Stage when snapshot was taken
    "snapshotData" JSONB NOT NULL,           -- Full workspace state at that moment
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,                  -- "user_saved" | "auto_save" | "stage_complete"
    
    CONSTRAINT "WorkspaceSnapshot_workspaceSessionId_fkey" FOREIGN KEY ("workspaceSessionId") REFERENCES "WorkspaceSession" ("id") ON DELETE CASCADE
);

CREATE INDEX "WorkspaceSnapshot_workspaceSessionId_idx" ON "WorkspaceSnapshot"("workspaceSessionId");
CREATE INDEX "WorkspaceSnapshot_workspaceSessionId_takenAt_idx" ON "WorkspaceSnapshot"("workspaceSessionId", "takenAt" DESC);

-- HomeDecisionCard: Pre-computed dashboard cards for Home page
-- Updated periodically (or on-demand) to avoid real-time computation
CREATE TABLE "HomeDecisionCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL UNIQUE,
    "cardType" TEXT NOT NULL,  -- "business_health" | "growth_forecast" | "compliance_risk" | "draft_queue" | "next_best_action"
    "data" JSONB NOT NULL,     -- Card-specific data structure
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "HomeDecisionCard_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "HomeDecisionCard_orgId_cardType_key" ON "HomeDecisionCard"("orgId", "cardType");
CREATE INDEX "HomeDecisionCard_orgId_idx" ON "HomeDecisionCard"("orgId");

-- MODIFY: ContentVariant — Link to WorkspaceSession
ALTER TABLE "ContentVariant" ADD COLUMN "workspaceSessionId" TEXT;
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_workspaceSessionId_fkey" 
  FOREIGN KEY ("workspaceSessionId") REFERENCES "WorkspaceSession" ("id") ON DELETE SET NULL;
CREATE INDEX "ContentVariant_workspaceSessionId_idx" ON "ContentVariant"("workspaceSessionId");

-- MODIFY: GrowthPrediction — Add explainability fields
ALTER TABLE "GrowthPrediction" ADD COLUMN "confidence" INTEGER DEFAULT 80;  -- 0-100
ALTER TABLE "GrowthPrediction" ADD COLUMN "reason" TEXT;                    -- Why this score
ALTER TABLE "GrowthPrediction" ADD COLUMN "recommendedAction" TEXT;         -- What to do
ALTER TABLE "GrowthPrediction" ADD COLUMN "evidence" JSONB;                 -- Drill-down data

-- MODIFY: ComplianceCheck — Add explainability fields
ALTER TABLE "ComplianceCheck" ADD COLUMN "explanation" TEXT;                -- Human-readable why
ALTER TABLE "ComplianceCheck" ADD COLUMN "recommendedFix" TEXT;             -- How to fix
ALTER TABLE "ComplianceCheck" ADD COLUMN "evidence" JSONB;                  -- Supporting data

-- MODIFY: Organization — Add relationships to new models
ALTER TABLE "Organization" ADD COLUMN "__workspace_sessions_count" INTEGER DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "__decision_cards_count" INTEGER DEFAULT 0;

-- Update indexes on modified tables
CREATE INDEX "GrowthPrediction_orgId_confidence_idx" ON "GrowthPrediction"("orgId", "confidence" DESC);
CREATE INDEX "ComplianceCheck_orgId_severity_idx" ON "ComplianceCheck"("orgId", "severity");

-- Add audit trail for workspace state changes
CREATE TABLE "WorkspaceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceSessionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,          -- "created" | "stage_changed" | "variant_selected" | "snapshot_created"
    "previousStage" TEXT,
    "newStage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "WorkspaceAuditLog_workspaceSessionId_fkey" FOREIGN KEY ("workspaceSessionId") REFERENCES "WorkspaceSession" ("id") ON DELETE CASCADE,
    CONSTRAINT "WorkspaceAuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
    CONSTRAINT "WorkspaceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX "WorkspaceAuditLog_workspaceSessionId_idx" ON "WorkspaceAuditLog"("workspaceSessionId");
CREATE INDEX "WorkspaceAuditLog_orgId_createdAt_idx" ON "WorkspaceAuditLog"("orgId", "createdAt" DESC);
