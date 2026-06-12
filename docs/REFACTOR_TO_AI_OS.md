# BizOpt → Modern AI Operating System Refactoring

**Mission:** Transform BizOpt from a tool collection into a cohesive AI workspace that feels like one connected system, not separate pages.

**Status:** Phase 2 Analysis Complete | Ready for Implementation

---

## 📊 Current State vs. Target State

### ✅ What's Working Well
- **Multi-tenancy:** Solid orgId-based architecture
- **Billing:** Stripe integration with trials, subscriptions, refunds
- **Platform Registry:** Extensible platform connector pattern
- **Media System:** Assets, carousels, audio layers
- **Growth/Compliance:** Core models exist (predictions, checks, findings)
- **UI Foundation:** Phase 1 completed (spinners, toasts, accessibility)
- **Backend Structure:** Clean service layer, queue workers, audit logs

### ❌ Critical Gaps (Blocking Competitive Differentiation)

| Gap | Current | Required | Impact |
|-----|---------|----------|--------|
| **State Container** | Scattered (IdeaBrief → ContentVariant → Campaign) | Unified WorkspaceSession | Users lose context when navigating |
| **Decision Cockpit** | 5+ separate pages per workflow | 5 decision cards on Home | High friction, unfocused UX |
| **Explainable Intelligence** | Growth/compliance outputs are scores only | Score + reason + confidence + evidence | Users don't trust recommendations |
| **Variant Comparison** | No compare workflow | Side-by-side + remix capability | Can't iterate on ideas |
| **Creation Flow** | Linear (idea → generate → manually schedule) | Structured cockpit (idea → generate → compare → edit → schedule) | Workflow friction |
| **Home Navigation** | Home from AI Studio requires manual navigation | One-click Home from anywhere | Users feel trapped in pages |
| **Dark Mode** | Partial support | System-wide theme tokens | Mobile/Apple readiness blocked |
| **Resumable State** | EditorSession exists but not connected to outputs | Workspace session snapshots at every decision | Users can't resume mid-workflow |

---

## 📋 Implementation Priority

### Phase 2.1: Core State Model (1-2 weeks) 🚀 **START HERE**
**Goal:** Build the Workspace Session system—the source of truth for all user progress.

#### 2.1.1 Database Schema Additions

```prisma
// NEW: Core workspace session—replaces scattered state
model WorkspaceSession {
  id                      String    @id @default(cuid())
  orgId                   String
  userId                  String
  
  // Journey stage
  stage                   String    @default("idea")    // idea → generate → compare → edit → schedule → publish → measure
  
  // Idea phase
  ideaPrompt              String    @db.Text
  businessGoal            String?
  tone                    String?   @default("professional")
  industry                String?
  audience                String?
  selectedPlatforms       String[]  @default([])
  
  // Generation phase
  generatedVariants       String[]  @default([])        // ContentVariant IDs
  selectedVariantId       String?
  compareViewOpen         Boolean   @default(false)
  
  // Edit phase
  editingAssetIds         String[]  @default([])        // Asset IDs being edited
  carouselState           Json?                          // Slide order, captions per slide
  
  // Schedule phase
  scheduleIntent          String?                        // "now" | DateTime
  scheduledPlatforms      String[]  @default([])
  
  // Publish phase
  campaignId              String?
  publishedAt             DateTime?
  
  // Measure phase
  growthPredictionId      String?
  growthSnapshotId        String?
  complianceCheckId       String?
  
  // Metadata
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  lastInteractionAt       DateTime  @default(now())
  expiresAt               DateTime?  // Auto-expire after 90 days
  
  org                     Organization        @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user                    User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  variants                ContentVariant[]     @relation("SessionVariants")
  campaign                Campaign?           @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  growthPrediction        GrowthPrediction?   @relation(fields: [growthPredictionId], references: [id], onDelete: SetNull)
  complianceCheck         ComplianceCheck?    @relation(fields: [complianceCheckId], references: [id], onDelete: SetNull)
  snapshots               WorkspaceSnapshot[]
  
  @@unique([orgId, id])
  @@index([orgId, userId])
  @@index([orgId, stage])
}

// NEW: Snapshots at key decision points for resumption + history
model WorkspaceSnapshot {
  id                  String    @id @default(cuid())
  workspaceSessionId  String
  stage               String    // stage when snapshot was taken
  snapshotData        Json      // Full workspace state at that moment
  takenAt             DateTime  @default(now())
  reason              String    // "user_saved" | "auto_save" | "stage_complete"
  
  session             WorkspaceSession @relation(fields: [workspaceSessionId], references: [id], onDelete: Cascade)
  
  @@index([workspaceSessionId])
  @@index([workspaceSessionId, takenAt])
}

// MODIFY: ContentVariant to link to WorkspaceSession
model ContentVariant {
  // ... existing fields ...
  workspaceSessionId  String?   // Link to session if part of a session workflow
  
  session             WorkspaceSession? @relation("SessionVariants", fields: [workspaceSessionId], references: [id], onDelete: SetNull)
}

// MODIFY: GrowthPrediction to add explainability
model GrowthPrediction {
  // ... existing fields ...
  score               Int
  confidence          Int       @default(80)  // NEW: 0-100
  reason              String?   @db.Text      // NEW: Why this score
  recommendedAction   String?   @db.Text      // NEW: What to do
  evidence            Json?                   // NEW: Drill-down data
  predictedReach      Float?
  predictedEngagement Float?
  bestPostHourUtc     Int?
  recommendedFormats  String[]
  createdAt           DateTime  @default(now())
}

// MODIFY: ComplianceCheck to add explainability
model ComplianceCheck {
  // ... existing fields ...
  status              String    // "pass" | "warn" | "fail"
  severity            String    // "info" | "warning" | "critical"
  title               String
  explanation         String?   @db.Text      // NEW: Human-readable why
  recommendedFix      String?   @db.Text      // NEW: How to fix
  evidence            Json?                   // NEW: Supporting data
  checkedAt           DateTime  @default(now())
}

// NEW: Home dashboard decision cards (pre-computed for performance)
model HomeDecisionCard {
  id              String    @id @default(cuid())
  orgId           String
  cardType        String    // "business_health" | "growth_forecast" | "compliance_risk" | "draft_queue" | "next_best_action"
  data            Json      // Card-specific data
  refreshedAt     DateTime  @default(now())
  
  org             Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  @@unique([orgId, cardType])
  @@index([orgId])
}
```

#### 2.1.2 API Routes to Create

```
app/api/workspace/
  ├── sessions/
  │   ├── [id]/          // GET, PATCH (workspace session state)
  │   ├── [id]/resume    // POST (load snapshot)
  │   └── [id]/snapshot  // POST (save state snapshot)
  └── [id]/complete-stage  // POST (move to next stage, save snapshot)

app/api/home/
  └── decision-cards     // GET (all 5 cards with latest data)
```

#### 2.1.3 Services to Create

```
services/workspace/
  ├── session.ts         // Core CRUD + stage transitions
  ├── snapshots.ts       // Save/restore workflow snapshots
  └── decision-cards.ts  // Compute 5 home cards

lib/workspace-state.ts  // Client-side workspace context
```

---

### Phase 2.2: Home as Decision Hub (1 week)
**Goal:** Transform Home into a focused 5-card dashboard.

#### 2.2.1 New Components

```
components/dashboard/
  ├── decision-card.tsx           // Base card component
  ├── business-health-card.tsx    // Status + quick actions
  ├── growth-forecast-card.tsx    // Score + trend + next action
  ├── compliance-risk-card.tsx    // Pass/warn/fail + severity
  ├── draft-queue-card.tsx        // Resumable sessions
  └── next-best-action-card.tsx   // One recommended action
```

#### 2.2.2 UI Pattern

```
Home Layout:
┌──────────────────────────────────────────────────┐
│ Trial Status (banner if active)                   │
├──────────────────────────────────────────────────┤
│ [Business Health]      [Growth Forecast]          │
│ [Compliance Risk]      [Drafts Queue]             │
│ [Next Best Action] (full width)                   │
├──────────────────────────────────────────────────┤
│ Quick Actions: Create from Idea | Connect Platform│
├──────────────────────────────────────────────────┤
│ Connected Platforms | Device Status               │
│ Scheduled Posts Summary                           │
└──────────────────────────────────────────────────┘
```

---

### Phase 2.3: AI Studio → Creation Cockpit (1-2 weeks)
**Goal:** Upgrade AI Studio into a structured journey with comparison + editing.

#### 2.3.1 New Components

```
components/ai/
  ├── creation-cockpit.tsx        // Main container (replaces ai-studio-view)
  ├── prompt-input-panel.tsx      // Left sidebar: inputs
  ├── variant-comparison.tsx      // CENTER: Cards with compare view
  ├── variant-remix-drawer.tsx    // Modal: remix + refine variant
  └── edit-media-preview.tsx      // Preview before scheduling

components/compare/
  ├── compare-view.tsx            // Side-by-side card comparison
  ├── variant-card.tsx            // Clickable variant with preview
  └── compare-actions.tsx         // Select, remix, compare buttons
```

#### 2.3.2 New Workflow State

```typescript
// Creation cockpit follows workspace session stage:
// Stage 1: Idea → Collect prompt, tone, goal, industry, audience, platforms
// Stage 2: Generate → Show variant cards
// Stage 3: Compare → Side-by-side view, remix capability
// Stage 4: Edit → Media editor (carousel, image, video, audio)
// Stage 5: Schedule → Calendar + platform selection
// (Save to campaign after stage 5)
```

#### 2.3.3 Comparison Matrix

```
Variant card shows:
┌─────────────────────┐
│ [Type Badge]        │ // caption | carousel | video | etc.
├─────────────────────┤
│ Content Preview     │ // First 2-3 lines or thumbnail
├─────────────────────┤
│ [Select] [Remix]    │ // Actions
│ [Compare] [Details] │
└─────────────────────┘

Remix drawer (modal):
- Regenerate this variant with different tone/goal/audience
- Save as new variant or replace current
```

---

### Phase 2.4: Explainable Intelligence (1 week)
**Goal:** Make growth and compliance outputs trustworthy and actionable.

#### 2.4.1 Growth Intelligence Enhancement

```typescript
// Current: score only
// New: score + reason + confidence + evidence + action

{
  score: 78,                      // 0-100
  confidence: 85,                 // How confident?
  reason: "Carousel posts with product images typically perform well in your audience segment on LinkedIn",
  recommendedAction: "Post Tuesday 2-4pm UTC (peak engagement time for your followers)",
  evidence: {
    reachTrend: [...],           // Last 10 posts reach data
    engagementByFormat: {
      carousel: 12.5,
      single_image: 8.2,
      text_only: 4.1
    },
    peakHoursUtc: [14, 15, 16],
    audienceSegment: "tech_founders"
  },
  drillDownUrl: "/growth-intelligence/analysis/..." // Detailed breakdown
}
```

#### 2.4.2 Compliance Intelligence Enhancement

```typescript
// Current: status + findings
// New: status + severity + explanation + fix + evidence

{
  status: "warn",                          // "pass" | "warn" | "fail"
  severity: "warning",                     // "info" | "warning" | "critical"
  title: "Business Profile Incomplete",
  explanation: "Your trading name is missing. This may affect payment processing.",
  recommendedFix: "Go to Settings > Business Profile and add your trading name.",
  evidence: {
    missingFields: ["tradingName"],
    impactArea: "billing",
    region: "EU"
  },
  actionUrl: "/settings/business-profile"
}
```

#### 2.4.3 Services to Update

```
services/growth/scoring.ts      // Add confidence, reason, evidence
services/compliance/checks.ts   // Add severity, explanation, fix
services/home/decision-cards.ts // Pre-compute cards with new fields
```

---

### Phase 2.5: Improved Media Editing & Carousels (1 week)
**Goal:** Make media editing richer and carousel building intuitive.

#### 2.5.1 Enhanced Carousel Builder

```
components/carousel/
  ├── carousel-editor.tsx        // Main carousel builder
  ├── slide-list.tsx             // Drag-to-reorder slides
  ├── slide-editor.tsx           // Edit caption + media per slide
  └── slide-preview.tsx          // WYSIWYG preview

// Supports:
// - Add/delete/reorder slides (drag handles)
// - Per-slide caption + media
// - Cross-platform preview (LinkedIn, Instagram, TikTok)
// - Save draft carousels for reuse
```

#### 2.5.2 Enhanced Media Editor

```
components/media/
  ├── media-editor.tsx           // Main editor
  ├── trim-tool.tsx              // Trim video/audio
  ├── crop-tool.tsx              // Crop image
  ├── reorder-tool.tsx           // Reorder multi-file media
  └── audio-mixer.tsx            // Layer background + voice

// Operations:
// - Trim: Video, audio to specific timestamps
// - Crop: Image to aspect ratios (1:1, 16:9, 4:5, 9:16)
// - Replace: Swap media asset
// - Reorder: Multi-file sequences
// - Audio: Mix background sound + voice overlay
// - Preview: Real-time WYSIWYG
```

---

### Phase 2.6: Universal Home Navigation (1 week)
**Goal:** Home must be one click away from any page; every workflow needs a Home action.

#### 2.6.1 Topbar Update

```
components/shell/app-topbar.tsx
// Add persistent Home icon + workspace label
// Show on all pages
// One click returns to Home (preserves state via WorkspaceSession)

┌──────────────────────────────────────────────────┐
│ [☰] BizOpt Workspace Name  [📊 Home] [👤 Menu]   │
└──────────────────────────────────────────────────┘
```

#### 2.6.2 Sidebar Links

```
Always show:
- Home (primary, always accessible)
- AI Studio (create new idea)
- Growth Intelligence
- Compliance Center
- Campaigns (active + drafts)
- Settings
- Integrations

Current page should show breadcrumb to Home
```

---

### Phase 2.7: Theme System & Dark Mode (1 week)
**Goal:** Token-based design system for instant theme switching (Apple readiness).

#### 2.7.1 Token System

```css
/* CSS Variables (tokens) */
:root {
  /* Colors */
  --color-bg: #ffffff;
  --color-surface: #f8f9fa;
  --color-card: #ffffff;
  --color-ink: #1a1a1a;
  --color-ink-muted: #666666;
  --color-border: #e0e0e0;
  --color-accent: #0066ff;
  --color-accent-soft: #e6f0ff;
  --color-accent-hover: #0052cc;
  
  /* Status colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Semantic */
  --color-pass: var(--color-success);
  --color-warn: var(--color-warning);
  --color-fail: var(--color-error);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0a0a0a;
    --color-surface: #1a1a1a;
    --color-card: #1f1f1f;
    --color-ink: #f0f0f0;
    --color-ink-muted: #999999;
    --color-border: #333333;
    /* ... etc */
  }
}
```

#### 2.7.2 Implementation

```
lib/theme.ts                     // Token definitions + theme hooks
components/theme-provider.tsx    // Client-side theme context
app/globals.css                  // Base tokens + media queries
tailwind.config.ts               // CSS variables integration
```

---

### Phase 2.8: Billing & Device Hardening (1 week)
**Goal:** Enforce one active device per subscription; stronger webhook idempotency.

#### 2.8.1 Device Management Enhancements

```prisma
// Already have Device model, enhance behavior:
// - Enforce device limit from Entitlement.deviceLimit
// - Add device revocation + binding time tracking
// - Track last seen + usage frequency
// - Require auth challenge for new device binding
```

#### 2.8.2 Webhook Resilience

```
workers/webhook-reconciler.ts    // Enhanced idempotency
// - Store event deduplication window (24h)
// - Retry logic with exponential backoff
// - Event replay for failed webhooks
// - Reconciliation job to fix state mismatches
```

---

### Phase 2.9: Apple Readiness & Modularity (1 week)
**Goal:** Structure so core business logic is reusable outside browser.

#### 2.9.1 Core Services Audit

```
services/          → Browser-agnostic logic only
lib/              → Utilities, no React dependencies
packages/core/    → Shared types, validators, platform definitions
workers/          → Queue jobs (already reusable)

❌ Move OUT of core services:
- Any direct NextRequest/Response handling
- React hooks or JSX
- Next.js-specific imports

✅ Keep in services:
- DB queries
- Business logic (growth calculations, compliance checks)
- Platform integrations
- Email/Stripe API calls
```

#### 2.9.2 New Structure

```
packages/core/
  ├── types/
  │   ├── platform.ts       // Platform enum, metadata
  │   ├── content.ts        // VariantType, media shapes
  │   ├── growth.ts         // GrowthPrediction interface
  │   └── compliance.ts     // ComplianceCheck interface
  ├── validators/           // Zod schemas for all inputs
  ├── constants/            // PLATFORMS, PLANS, etc.
  └── utils/                // Shared functions

services/                    // Now fully reusable
api/                         // Thin wrappers around services
```

See [APPLE.md](./APPLE.md) for full detail.

---

## 🛠️ Implementation Checklist

### Phase 2.1: Core State Model
- [ ] Add WorkspaceSession model
- [ ] Add WorkspaceSnapshot model
- [ ] Modify ContentVariant (add workspaceSessionId)
- [ ] Modify GrowthPrediction (add confidence, reason, recommendedAction, evidence)
- [ ] Modify ComplianceCheck (add explanation, recommendedFix, evidence)
- [ ] Add HomeDecisionCard model
- [ ] Create workspace sessions API
- [ ] Create workspace snapshots service
- [ ] Create home decision cards service
- [ ] Add workspace context (client-side state management)

### Phase 2.2: Home Dashboard
- [ ] Create Decision Card component
- [ ] Create Business Health card
- [ ] Create Growth Forecast card
- [ ] Create Compliance Risk card
- [ ] Create Draft Queue card
- [ ] Create Next Best Action card
- [ ] Update Home page layout
- [ ] Implement decision card auto-refresh

### Phase 2.3: Creation Cockpit
- [ ] Rename ai-studio-view to creation-cockpit
- [ ] Add stage-based UI (idea → generate → compare → edit → schedule)
- [ ] Create variant comparison component
- [ ] Create remix drawer
- [ ] Add media preview before scheduling
- [ ] Connect to WorkspaceSession state
- [ ] Update variant selection to save stage

### Phase 2.4: Explainable Intelligence
- [ ] Update growth scoring service (add confidence, reason, evidence)
- [ ] Update compliance checks service (add severity, explanation, fix)
- [ ] Create growth explanation page
- [ ] Create compliance drill-down page
- [ ] Update Home cards to show explanations

### Phase 2.5: Media Editing
- [ ] Create carousel editor component
- [ ] Add slide reordering (drag handle)
- [ ] Create media editor component
- [ ] Add trim tool
- [ ] Add crop tool
- [ ] Add audio mixer
- [ ] Update campaign media workflow

### Phase 2.6: Universal Home Navigation
- [ ] Update AppTopbar with persistent Home button
- [ ] Update sidebar to show Home as primary
- [ ] Add breadcrumb to Home from any page
- [ ] Verify all pages link back to Home
- [ ] Test one-click return + state preservation

### Phase 2.7: Theme System
- [ ] Define CSS token system
- [ ] Create theme variables file
- [ ] Update globals.css with tokens
- [ ] Create theme provider
- [ ] Add dark mode support
- [ ] Update tailwind.config.ts
- [ ] Test theme switching

### Phase 2.8: Billing & Device Hardening
- [ ] Enforce device limit in auth
- [ ] Enhance webhook deduplication
- [ ] Add device revocation flow
- [ ] Add webhook reconciliation job

### Phase 2.9: Apple Readiness
- [ ] Audit all services for React/Next.js imports
- [ ] Move types to packages/core
- [ ] Create validators in packages/core
- [ ] Document reusable layer
- [ ] Update APPLE.md with implementation notes

---

## 📦 File Tree Changes Summary

### New Directories
```
app/api/workspace/
app/api/home/
components/compare/
components/media/ (enhance existing)
components/carousel/ (enhance existing)
services/workspace/
packages/core/ (expand existing)
```

### New Files
```
prisma/migrations/
  └── add_workspace_sessions/          // Schema updates

app/api/workspace/sessions/
  ├── route.ts
  ├── [id]/route.ts
  ├── [id]/resume/route.ts
  └── [id]/snapshot/route.ts

app/api/home/
  └── decision-cards/route.ts

components/dashboard/
  ├── decision-card.tsx
  ├── business-health-card.tsx
  ├── growth-forecast-card.tsx
  ├── compliance-risk-card.tsx
  ├── draft-queue-card.tsx
  └── next-best-action-card.tsx

components/compare/
  ├── compare-view.tsx
  ├── variant-card.tsx
  └── compare-actions.tsx

components/media/
  ├── media-editor.tsx
  ├── trim-tool.tsx
  ├── crop-tool.tsx
  └── audio-mixer.tsx

components/carousel/
  ├── carousel-editor.tsx
  ├── slide-list.tsx
  └── slide-editor.tsx

services/workspace/
  ├── session.ts
  ├── snapshots.ts
  └── decision-cards.ts

lib/
  ├── workspace-state.ts
  └── theme.ts

packages/core/
  ├── types/ (expand)
  ├── validators/ (create)
  └── utils/ (expand)
```

### Modified Files
```
prisma/schema.prisma
app/(app)/home/page.tsx
app/(app)/ai-studio/ai-studio-view.tsx
app/globals.css
components/shell/app-topbar.tsx
components/shell/sidebar.tsx
lib/theme.ts (update)
tailwind.config.ts
services/growth/scoring.ts
services/compliance/checks.ts
types/next-auth.d.ts
```

---

## 🎯 Success Metrics

### User Experience
- ✅ Home → AI Studio → Compare → Edit → Schedule in <5 clicks
- ✅ Users can resume any workflow from Home
- ✅ Explainability score > 8/10 (users trust growth/compliance outputs)
- ✅ Theme switch is instant (no page reload)
- ✅ Mobile feels responsive and native-like

### Technical
- ✅ 0 TypeScript errors
- ✅ Lighthouse Core Web Vitals > 90
- ✅ All workflows covered by E2E tests
- ✅ Webhook idempotency 99.99% uptime
- ✅ Device limit enforced 100% of time

### Business
- ✅ Trial completion rate increases (better onboarding)
- ✅ Higher feature discoverability (Home → decision cards)
- ✅ Lower cart abandonment (smoother checkout)
- ✅ Apple app store ready (modular architecture)

---

## 📞 Next Steps

1. **Review & Align** — Confirm this plan matches your vision
2. **Prioritize** — Confirm Phase 2.1 → 2.2 → 2.3 order
3. **Database** — Run Prisma migration for new models
4. **Start Phase 2.1** — Build WorkspaceSession system
5. **Iterate** — Two-week sprints per phase

---

## 📚 References

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Current tech stack
- [APPLE.md](./APPLE.md) — Apple readiness requirements
- [PRD.md](./PRD.md) — Product vision
- [PHASE1_COMPLETION_REPORT.md](./PHASE1_COMPLETION_REPORT.md) — UI/UX improvements done
