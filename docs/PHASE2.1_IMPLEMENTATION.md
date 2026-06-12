# Phase 2.1 Implementation Guide: Workspace Session System

**Goal:** Build the unified state container that becomes the single source of truth for all user progress.

**Timeline:** 1-2 weeks | **Priority:** 🔴 CRITICAL (unblocks all other phases)

---

## Step 1: Database Schema

### 1.1 Update `prisma/schema.prisma`

Add all models from [PHASE2.1_SCHEMA_ADDITIONS.md](./PHASE2.1_SCHEMA_ADDITIONS.md):
- `WorkspaceSession` (core model)
- `WorkspaceSnapshot` (resumption + history)
- `HomeDecisionCard` (pre-computed cards)
- `WorkspaceAuditLog` (audit trail)

Modify existing models:
- `ContentVariant` → add `workspaceSessionId`
- `GrowthPrediction` → add `confidence, reason, recommendedAction, evidence`
- `ComplianceCheck` → add `explanation, recommendedFix, evidence`

### 1.2 Create Migration

```bash
cd BizOpt
npx prisma migrate dev --name add_workspace_sessions
# This will:
# 1. Generate migration file
# 2. Run SQL against database
# 3. Update Prisma client
```

### 1.3 Generate Prisma Client

```bash
npm run db:generate
```

---

## Step 2: Service Layer

### 2.1 Create `services/workspace/session.ts`

```typescript
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

export type WorkspaceStage = 
  | "idea" 
  | "generate" 
  | "compare" 
  | "edit" 
  | "schedule" 
  | "publish" 
  | "measure";

/**
 * Create a new workspace session
 * Called when user starts "Create from Idea"
 */
export async function createWorkspaceSession(
  orgId: string,
  userId: string,
  input: {
    ideaPrompt: string;
    businessGoal?: string;
    tone?: string;
    industry?: string;
    audience?: string;
    selectedPlatforms?: string[];
  }
) {
  return db.workspaceSession.create({
    data: {
      orgId,
      userId,
      stage: "idea",
      ideaPrompt: input.ideaPrompt,
      businessGoal: input.businessGoal,
      tone: input.tone || "professional",
      industry: input.industry,
      audience: input.audience,
      selectedPlatforms: input.selectedPlatforms || [],
    },
  });
}

/**
 * Get workspace session with all related data
 */
export async function getWorkspaceSession(sessionId: string) {
  return db.workspaceSession.findUnique({
    where: { id: sessionId },
    include: {
      variants: {
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          isSelected: true,
          createdAt: true,
        },
      },
      selectedVariant: true,
      campaign: true,
      growthPrediction: {
        select: {
          score: true,
          confidence: true,
          reason: true,
          recommendedAction: true,
          evidence: true,
        },
      },
      complianceCheck: true,
      snapshots: {
        orderBy: { takenAt: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * Transition to next stage
 * Saves snapshot before transitioning
 */
export async function transitionStage(
  sessionId: string,
  nextStage: WorkspaceStage,
  updates?: Partial<Prisma.WorkspaceSessionUpdateInput>
) {
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  // Create snapshot of current state before transition
  await db.workspaceSnapshot.create({
    data: {
      workspaceSessionId: sessionId,
      stage: session.stage,
      snapshotData: {
        // Serialize full state
        stage: session.stage,
        ideaPrompt: session.ideaPrompt,
        businessGoal: session.businessGoal,
        tone: session.tone,
        industry: session.industry,
        audience: session.audience,
        selectedPlatforms: session.selectedPlatforms,
        selectedVariantId: session.selectedVariantId,
        carouselState: session.carouselState,
        scheduleIntent: session.scheduleIntent,
        scheduledPlatforms: session.scheduledPlatforms,
      },
      reason: "stage_complete",
    },
  });

  // Transition to next stage
  return db.workspaceSession.update({
    where: { id: sessionId },
    data: {
      stage: nextStage,
      lastInteractionAt: new Date(),
      ...updates,
    },
  });
}

/**
 * Update workspace session
 * Respects current stage (idea-phase fields vs. edit-phase fields)
 */
export async function updateWorkspaceSession(
  sessionId: string,
  updates: Partial<Prisma.WorkspaceSessionUpdateInput>,
  snapshot = false
) {
  if (snapshot) {
    const session = await db.workspaceSession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    // Auto-save snapshot before update
    await db.workspaceSnapshot.create({
      data: {
        workspaceSessionId: sessionId,
        stage: session.stage,
        snapshotData: {
          stage: session.stage,
          ideaPrompt: session.ideaPrompt,
          businessGoal: session.businessGoal,
          tone: session.tone,
          industry: session.industry,
          audience: session.audience,
          selectedPlatforms: session.selectedPlatforms,
          selectedVariantId: session.selectedVariantId,
          carouselState: session.carouselState,
          scheduleIntent: session.scheduleIntent,
          scheduledPlatforms: session.scheduledPlatforms,
        },
        reason: "auto_save",
      },
    });
  }

  return db.workspaceSession.update({
    where: { id: sessionId },
    data: {
      ...updates,
      lastInteractionAt: new Date(),
    },
  });
}

/**
 * Resume from a snapshot
 * Restore all session state from saved point
 */
export async function resumeFromSnapshot(
  sessionId: string,
  snapshotId: string
) {
  const snapshot = await db.workspaceSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
  });

  // Save current state as new snapshot (for undo)
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  await db.workspaceSnapshot.create({
    data: {
      workspaceSessionId: sessionId,
      stage: session.stage,
      snapshotData: {
        stage: session.stage,
        ideaPrompt: session.ideaPrompt,
        businessGoal: session.businessGoal,
        tone: session.tone,
        industry: session.industry,
        audience: session.audience,
        selectedPlatforms: session.selectedPlatforms,
        selectedVariantId: session.selectedVariantId,
        carouselState: session.carouselState,
        scheduleIntent: session.scheduleIntent,
        scheduledPlatforms: session.scheduledPlatforms,
      },
      reason: "before_restore",
    },
  });

  // Restore from snapshot
  const data = snapshot.snapshotData as Record<string, any>;
  return db.workspaceSession.update({
    where: { id: sessionId },
    data: {
      stage: data.stage,
      ideaPrompt: data.ideaPrompt,
      businessGoal: data.businessGoal,
      tone: data.tone,
      industry: data.industry,
      audience: data.audience,
      selectedPlatforms: data.selectedPlatforms,
      selectedVariantId: data.selectedVariantId,
      carouselState: data.carouselState,
      scheduleIntent: data.scheduleIntent,
      scheduledPlatforms: data.scheduledPlatforms,
      lastInteractionAt: new Date(),
    },
  });
}

/**
 * List resumable sessions for user (Home page)
 */
export async function listResumableSessions(orgId: string, userId: string) {
  return db.workspaceSession.findMany({
    where: {
      orgId,
      userId,
      expiresAt: {
        gt: new Date(), // Not expired
      },
    },
    orderBy: { lastInteractionAt: "desc" },
    take: 5,
    select: {
      id: true,
      stage: true,
      ideaPrompt: true,
      createdAt: true,
      lastInteractionAt: true,
      selectedVariantId: true,
      campaignId: true,
    },
  });
}

/**
 * Clean up expired sessions (run as background job)
 */
export async function deleteExpiredSessions() {
  return db.workspaceSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

/**
 * Audit log: track state changes
 */
export async function logWorkspaceAction(
  sessionId: string,
  orgId: string,
  userId: string,
  action: string,
  metadata?: Record<string, any>
) {
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  return db.workspaceAuditLog.create({
    data: {
      workspaceSessionId: sessionId,
      orgId,
      userId,
      action,
      previousStage: undefined,
      newStage: session.stage,
      metadata,
    },
  });
}
```

### 2.2 Create `services/workspace/snapshots.ts`

```typescript
import { db } from "@/lib/db";

/**
 * Create a manual snapshot (user clicked "Save")
 */
export async function saveWorkspaceSnapshot(
  sessionId: string,
  reason = "user_saved"
) {
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  return db.workspaceSnapshot.create({
    data: {
      workspaceSessionId: sessionId,
      stage: session.stage,
      snapshotData: {
        stage: session.stage,
        ideaPrompt: session.ideaPrompt,
        businessGoal: session.businessGoal,
        tone: session.tone,
        industry: session.industry,
        audience: session.audience,
        selectedPlatforms: session.selectedPlatforms,
        selectedVariantId: session.selectedVariantId,
        carouselState: session.carouselState,
        scheduleIntent: session.scheduleIntent,
        scheduledPlatforms: session.scheduledPlatforms,
      },
      reason,
    },
  });
}

/**
 * Get snapshot history (for undo/version timeline)
 */
export async function getSnapshotHistory(sessionId: string, limit = 20) {
  return db.workspaceSnapshot.findMany({
    where: { workspaceSessionId: sessionId },
    orderBy: { takenAt: "desc" },
    take: limit,
    select: {
      id: true,
      stage: true,
      reason: true,
      takenAt: true,
    },
  });
}

/**
 * Get full snapshot data for restore
 */
export async function getSnapshot(snapshotId: string) {
  return db.workspaceSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
  });
}
```

### 2.3 Create `services/workspace/decision-cards.ts`

```typescript
import { db } from "@/lib/db";
import { getGrowthDashboard } from "@/services/growth/scoring";
import { getComplianceSummary } from "@/services/compliance/checks";

/**
 * Compute all 5 home decision cards
 * Run on-demand or via scheduled job
 */
export async function computeHomeDecisionCards(orgId: string) {
  const [entitlement, subscription, drafts, growth, compliance] = await Promise.all([
    db.entitlement.findUnique({ where: { orgId } }),
    db.subscription.findUnique({ where: { orgId } }),
    db.workspaceSession.findMany({
      where: {
        orgId,
        stage: { in: ["compare", "edit", "schedule"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastInteractionAt: "desc" },
    }),
    getGrowthDashboard(orgId),
    getComplianceSummary(orgId),
  ]);

  // 1. Business Health Card
  const businessHealthData = {
    status: entitlement?.active ? "healthy" : "setup_needed",
    billingStatus: subscription?.status || "pending_payment",
    hasConnectedPlatforms: (await db.platformAccount.count({ where: { orgId } })) > 0,
    businessProfileComplete:
      (await db.businessProfile.count({ where: { orgId } })) > 0,
  };

  await db.homeDecisionCard.upsert({
    where: { orgId_cardType: { orgId, cardType: "business_health" } },
    update: { data: businessHealthData, refreshedAt: new Date() },
    create: {
      orgId,
      cardType: "business_health",
      data: businessHealthData,
    },
  });

  // 2. Growth Forecast Card
  const recentPrediction = await db.growthPrediction.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const growthForecastData = {
    score: recentPrediction?.score || 0,
    confidence: recentPrediction?.confidence || 0,
    trend: growth?.trend || "stable",
    bestPostHour: recentPrediction?.bestPostHourUtc,
    recommendedAction: recentPrediction?.recommendedAction,
    reason: recentPrediction?.reason,
  };

  await db.homeDecisionCard.upsert({
    where: { orgId_cardType: { orgId, cardType: "growth_forecast" } },
    update: { data: growthForecastData, refreshedAt: new Date() },
    create: {
      orgId,
      cardType: "growth_forecast",
      data: growthForecastData,
    },
  });

  // 3. Compliance Risk Card
  const failingChecks = await db.complianceCheck.count({
    where: { orgId, status: "fail" },
  });
  const warningChecks = await db.complianceCheck.count({
    where: { orgId, status: "warn" },
  });

  const complianceRiskData = {
    status: failingChecks > 0 ? "fail" : warningChecks > 0 ? "warn" : "pass",
    failingCount: failingChecks,
    warningCount: warningChecks,
    criticalIssue: (
      await db.complianceCheck.findFirst({
        where: { orgId, severity: "critical", status: { in: ["fail", "warn"] } },
        orderBy: { checkedAt: "desc" },
      })
    )?.title,
  };

  await db.homeDecisionCard.upsert({
    where: { orgId_cardType: { orgId, cardType: "compliance_risk" } },
    update: { data: complianceRiskData, refreshedAt: new Date() },
    create: {
      orgId,
      cardType: "compliance_risk",
      data: complianceRiskData,
    },
  });

  // 4. Draft Queue Card
  const draftQueueData = {
    count: drafts.length,
    drafts: drafts.map((d) => ({
      id: d.id,
      prompt: d.ideaPrompt.slice(0, 50) + "...",
      stage: d.stage,
      lastInteracted: d.lastInteractionAt,
    })),
  };

  await db.homeDecisionCard.upsert({
    where: { orgId_cardType: { orgId, cardType: "draft_queue" } },
    update: { data: draftQueueData, refreshedAt: new Date() },
    create: {
      orgId,
      cardType: "draft_queue",
      data: draftQueueData,
    },
  });

  // 5. Next Best Action Card
  let nextAction = {
    title: "Create from Idea",
    description: "Start a new content idea",
    icon: "sparkles",
    cta: "/ai-studio",
  };

  if (failingChecks > 0) {
    nextAction = {
      title: "Fix Compliance Issue",
      description: `${failingChecks} critical issue${failingChecks !== 1 ? "s" : ""} need attention`,
      icon: "alert-circle",
      cta: "/compliance-center",
    };
  } else if (!businessHealthData.hasConnectedPlatforms) {
    nextAction = {
      title: "Connect Your First Platform",
      description: "Link LinkedIn, Instagram, or other platforms",
      icon: "link",
      cta: "/integrations",
    };
  } else if (drafts.length > 0) {
    nextAction = {
      title: "Resume Draft",
      description: `Continue from ${drafts[0]?.stage}`,
      icon: "arrow-right",
      cta: `/ai-studio?session=${drafts[0]?.id}`,
    };
  }

  const nextActionData = nextAction;

  await db.homeDecisionCard.upsert({
    where: { orgId_cardType: { orgId, cardType: "next_best_action" } },
    update: { data: nextActionData, refreshedAt: new Date() },
    create: {
      orgId,
      cardType: "next_best_action",
      data: nextActionData,
    },
  });

  return {
    businessHealth: businessHealthData,
    growthForecast: growthForecastData,
    complianceRisk: complianceRiskData,
    draftQueue: draftQueueData,
    nextBestAction: nextActionData,
  };
}

/**
 * Get all home decision cards for org
 */
export async function getHomeDecisionCards(orgId: string) {
  const cards = await db.homeDecisionCard.findMany({
    where: { orgId },
  });

  return Object.fromEntries(
    cards.map((c) => [c.cardType, c.data])
  );
}
```

---

## Step 3: API Routes

### 3.1 Create `app/api/workspace/sessions/route.ts`

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { createWorkspaceSession, listResumableSessions } from "@/services/workspace/session";
import { NextRequest, NextResponse } from "next/server";

// POST: Create new workspace session
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  
  const workspaceSession = await createWorkspaceSession(org.id, session.user.id, body);
  
  return NextResponse.json(workspaceSession);
}

// GET: List resumable sessions
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const sessions = await listResumableSessions(org.id, session.user.id);
  
  return NextResponse.json({ sessions });
}
```

### 3.2 Create `app/api/workspace/[id]/route.ts`

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getWorkspaceSession, updateWorkspaceSession } from "@/services/workspace/session";
import { NextRequest, NextResponse } from "next/server";

// GET: Retrieve workspace session
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const workspaceSession = await getWorkspaceSession(params.id);
  
  if (!workspaceSession || workspaceSession.orgId !== org.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(workspaceSession);
}

// PATCH: Update workspace session
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  
  const updated = await updateWorkspaceSession(params.id, body);
  
  return NextResponse.json(updated);
}
```

### 3.3 Create `app/api/workspace/[id]/complete-stage/route.ts`

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { transitionStage } from "@/services/workspace/session";
import { NextRequest, NextResponse } from "next/server";

// POST: Transition to next stage
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const { nextStage, updates } = body;
  
  const updated = await transitionStage(params.id, nextStage, updates);
  
  return NextResponse.json(updated);
}
```

### 3.4 Create `app/api/home/decision-cards/route.ts`

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { computeHomeDecisionCards, getHomeDecisionCards } from "@/services/workspace/decision-cards";
import { NextRequest, NextResponse } from "next/server";

// GET: Retrieve home decision cards
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const cards = await getHomeDecisionCards(org.id);
  
  return NextResponse.json(cards);
}

// POST: Refresh/compute decision cards
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  const cards = await computeHomeDecisionCards(org.id);
  
  return NextResponse.json(cards);
}
```

---

## Step 4: Client-Side Integration

### 4.1 Create `lib/workspace-state.ts` (Context + Hooks)

```typescript
"use client";

import { createContext, useContext, useState, useCallback } from "react";

type WorkspaceContextType = {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  stage: string;
  setStage: (stage: string) => void;
  ideaPrompt: string;
  setIdeaPrompt: (prompt: string) => void;
  // ... other state fields
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState("idea");
  const [ideaPrompt, setIdeaPrompt] = useState("");

  return (
    <WorkspaceContext.Provider
      value={{
        sessionId,
        setSessionId,
        stage,
        setStage,
        ideaPrompt,
        setIdeaPrompt,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceSession() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceSession must be used inside WorkspaceProvider");
  }
  return context;
}
```

### 4.2 Update `app/providers.tsx`

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/lib/toast-context";
import { WorkspaceProvider } from "@/lib/workspace-state";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WorkspaceProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </WorkspaceProvider>
    </SessionProvider>
  );
}
```

---

## Step 5: Testing Checklist

- [ ] Database migration runs without errors
- [ ] Prisma client generates successfully
- [ ] Create workspace session API works
- [ ] Retrieve workspace session API works
- [ ] Transition stage API works
- [ ] Decision cards compute correctly
- [ ] Home page displays 5 cards
- [ ] Resume from snapshot restores state
- [ ] Snapshots auto-save on stage transition
- [ ] Expired sessions are cleaned up
- [ ] Audit logs track changes

---

## Step 6: Next Phase

Once Phase 2.1 is complete:

1. **Phase 2.2** → Transform Home into 5-card dashboard
2. **Phase 2.3** → Upgrade AI Studio to use WorkspaceSession
3. **Phase 2.4** → Add explainability fields to growth/compliance services

See [REFACTOR_TO_AI_OS.md](./REFACTOR_TO_AI_OS.md) for full roadmap.
