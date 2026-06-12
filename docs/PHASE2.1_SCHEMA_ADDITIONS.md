// Phase 2.1: Workspace Session Schema Additions
// Add these models to prisma/schema.prisma

// CORE: Workspace Session — Single source of truth for entire content creation journey
// Replaces fragmented state across IdeaBrief → ContentVariant → Campaign
model WorkspaceSession {
  id                      String    @id @default(cuid())
  orgId                   String
  userId                  String
  
  // Journey stage (tracks user progress through workflow)
  stage                   String    @default("idea")  // idea → generate → compare → edit → schedule → publish → measure
  
  // === IDEA PHASE ===
  // Raw input: the business idea and context
  ideaPrompt              String    @db.Text
  businessGoal            String?
  tone                    String?   @default("professional")
  industry                String?
  audience                String?
  selectedPlatforms       String[]  @default([])  // Platform keys (linkedin, instagram, etc.)
  
  // === GENERATION PHASE ===
  // AI-generated outputs
  generatedVariants       String[]  @default([])  // ContentVariant IDs
  selectedVariantId       String?                 // Which variant user chose
  compareViewOpen         Boolean   @default(false)
  
  // === EDIT PHASE ===
  // Media and content refinement
  editingAssetIds         String[]  @default([])  // Asset IDs being edited
  carouselState           Json?                   // { slides: [...], selectedSlideIndex: 0 }
  
  // === SCHEDULE PHASE ===
  // Publishing intent
  scheduleIntent          String?                 // "now" or ISO datetime string
  scheduledPlatforms      String[]  @default([])  // Platforms to publish to
  
  // === PUBLISH PHASE ===
  // Post-publication tracking
  campaignId              String?
  publishedAt             DateTime?
  
  // === MEASURE PHASE ===
  // Post-publication intelligence
  growthPredictionId      String?
  growthSnapshotId        String?
  complianceCheckId       String?
  
  // Metadata
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  lastInteractionAt       DateTime  @default(now())
  expiresAt               DateTime?  // Auto-expire old sessions after 90 days
  
  // Relations
  org                     Organization        @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user                    User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  selectedVariant         ContentVariant?     @relation(fields: [selectedVariantId], references: [id], onDelete: SetNull, name: "SessionSelectedVariant")
  campaign                Campaign?           @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  growthPrediction        GrowthPrediction?   @relation(fields: [growthPredictionId], references: [id], onDelete: SetNull)
  complianceCheck         ComplianceCheck?    @relation(fields: [complianceCheckId], references: [id], onDelete: SetNull)
  variants                ContentVariant[]    @relation("SessionVariants")
  snapshots               WorkspaceSnapshot[]
  auditLogs               WorkspaceAuditLog[]
  
  @@unique([orgId, id])
  @@index([orgId, userId])
  @@index([orgId, stage])
  @@index([orgId, lastInteractionAt])
  @@index([expiresAt])
}

// Workspace Snapshots — Point-in-time state capture for resumption + undo
// Users can resume from any snapshot, or browse history
model WorkspaceSnapshot {
  id                  String    @id @default(cuid())
  workspaceSessionId  String
  stage               String    // Stage when this snapshot was taken
  snapshotData        Json      // Full serialized workspace state: { prompt, tone, variants, selectedId, etc. }
  takenAt             DateTime  @default(now())
  reason              String    // "user_saved" | "auto_save" | "stage_complete" | "before_edit"
  
  session             WorkspaceSession @relation(fields: [workspaceSessionId], references: [id], onDelete: Cascade)
  
  @@index([workspaceSessionId])
  @@index([workspaceSessionId, takenAt])
}

// Home Decision Cards — Pre-computed dashboard data
// Updated on-demand or periodically to avoid real-time computation load
model HomeDecisionCard {
  id              String    @id @default(cuid())
  orgId           String    @unique
  cardType        String    // "business_health" | "growth_forecast" | "compliance_risk" | "draft_queue" | "next_best_action"
  data            Json      // Card-specific structure: { score, trend, action, etc. }
  refreshedAt     DateTime  @default(now())
  
  org             Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  @@unique([orgId, cardType])
  @@index([orgId])
}

// Workspace Audit Log — Track state changes for compliance + debugging
model WorkspaceAuditLog {
  id                  String    @id @default(cuid())
  workspaceSessionId  String
  orgId               String
  userId              String
  action              String    // "created" | "stage_changed" | "variant_selected" | "snapshot_created" | "edited"
  previousStage       String?
  newStage            String?
  metadata            Json?     // Action-specific metadata
  createdAt           DateTime  @default(now())
  
  session             WorkspaceSession @relation(fields: [workspaceSessionId], references: [id], onDelete: Cascade)
  org                 Organization     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user                User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([workspaceSessionId])
  @@index([orgId, createdAt])
}

// ===== MODIFICATIONS TO EXISTING MODELS =====

// MODIFY: Organization — Add workspace session relations
model Organization {
  // ... existing fields ...
  
  // NEW RELATIONS
  workspaceSessions   WorkspaceSession[]
  decisionCards       HomeDecisionCard[]
  workspaceAuditLogs  WorkspaceAuditLog[]
}

// MODIFY: User — Add workspace session relations
model User {
  // ... existing fields ...
  
  // NEW RELATIONS
  workspaceSessions   WorkspaceSession[]
  workspaceAuditLogs  WorkspaceAuditLog[]
}

// MODIFY: ContentVariant — Link to WorkspaceSession
model ContentVariant {
  // ... existing fields ...
  
  // NEW FIELD
  workspaceSessionId  String?   // Link to session if part of session workflow
  
  // NEW RELATIONS
  session             WorkspaceSession? @relation("SessionVariants", fields: [workspaceSessionId], references: [id], onDelete: SetNull)
  selectedBySession   WorkspaceSession? @relation("SessionSelectedVariant")
  
  // NEW INDEXES
  @@index([workspaceSessionId])
}

// MODIFY: GrowthPrediction — Add explainability fields
model GrowthPrediction {
  // ... existing fields ...
  score               Int
  
  // NEW FIELDS FOR EXPLAINABILITY
  confidence          Int       @default(80)  // 0-100: How confident is this prediction?
  reason              String?   @db.Text      // Human-readable: Why this score?
  recommendedAction   String?   @db.Text      // What should the user do?
  evidence            Json?                   // Drill-down data: { reachTrend, engagementByFormat, peakHours, etc. }
  
  // Existing fields
  predictedReach      Float?
  predictedEngagement Float?
  predictedConversion Float?
  bestPostHourUtc     Int?
  recommendedFormats  String[]
  label               String?
  explanation         String?   @db.Text
  createdAt           DateTime  @default(now())
  
  // NEW INDEXES
  @@index([orgId, confidence])
  @@index([orgId, createdAt])
}

// MODIFY: ComplianceCheck — Add explainability fields
model ComplianceCheck {
  id              String    @id @default(cuid())
  orgId           String
  ruleId          String?
  
  status          String    // "pass" | "warn" | "fail"
  severity        String    // "info" | "warning" | "critical"
  title           String
  
  // ENHANCED EXPLAINABILITY FIELDS
  explanation     String?   @db.Text      // Why did this check fail/warn? (human-readable)
  recommendedFix  String?   @db.Text      // How to fix it?
  evidence        Json?                   // Supporting data: { missingFields, impactArea, region, etc. }
  
  // Existing fields
  details         String?   @db.Text
  remediation     String?   @db.Text
  checkedAt       DateTime  @default(now())
  
  // Relations
  org             Organization               @relation(fields: [orgId], references: [id], onDelete: Cascade)
  rule            ComplianceRule?            @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  findings        ComplianceFinding[]
  recommendations ComplianceRecommendation[]
  sessions        WorkspaceSession[]
  
  // NEW INDEXES
  @@index([orgId, severity])
  @@index([orgId, status])
}
