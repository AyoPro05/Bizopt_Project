import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    orgMember: { findUnique: vi.fn() },
    workspaceSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    workspaceSnapshot: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceAuditLog: {
      create: vi.fn(),
    },
    homeDecisionCard: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    entitlement: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    platformAccount: { count: vi.fn() },
    businessProfile: { count: vi.fn() },
    complianceCheck: { count: vi.fn(), findFirst: vi.fn() },
    growthPrediction: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import { createWorkspaceSession, listResumableSessions, updateWorkspaceSession } from "@/services/workspace/session";

describe("workspace session core flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (work: (tx: typeof db) => unknown) => work(db));
    db.orgMember.findUnique.mockResolvedValue({ role: "owner" });
  });

  it("creates a session with the right initial state", async () => {
    db.workspaceSession.create.mockResolvedValue({ id: "session_1", orgId: "org_1", userId: "user_1", stage: "idea", ideaPrompt: "Launch a campaign" });

    const created = await createWorkspaceSession("org_1", "user_1", {
      ideaPrompt: "Launch a campaign",
      businessGoal: "Grow revenue",
      selectedPlatforms: ["linkedin"],
    });

    expect(db.workspaceSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        userId: "user_1",
        stage: "idea",
        ideaPrompt: "Launch a campaign",
        businessGoal: "Grow revenue",
        tone: "professional",
        selectedPlatforms: ["linkedin"],
      }),
    });
    expect(created.id).toBe("session_1");
  });

  it("updates a session and saves relevant metadata", async () => {
    db.workspaceSession.findFirst.mockResolvedValue({
      id: "session_1",
      stage: "idea",
      ideaPrompt: "Launch a campaign",
      businessGoal: "Grow revenue",
      tone: "professional",
      industry: null,
      audience: null,
      selectedPlatforms: ["linkedin"],
      selectedVariantId: null,
      carouselState: null,
      scheduleIntent: null,
      scheduledPlatforms: [],
    });
    db.workspaceSession.update.mockResolvedValue({ id: "session_1", ideaPrompt: "Edited idea" });

    await updateWorkspaceSession("session_1", { ideaPrompt: "Edited idea" }, { orgId: "org_1", userId: "user_1" }, true);

    expect(db.workspaceSnapshot.create).toHaveBeenCalled();
    expect(db.workspaceSession.update).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "session_1", orgId: "org_1", userId: "user_1" }),
      data: expect.objectContaining({ ideaPrompt: "Edited idea", lastInteractionAt: expect.any(Date) }),
    });
  });

  it("lists active resumable sessions in newest-first order", async () => {
    db.workspaceSession.findMany.mockResolvedValue([
      { id: "s2", stage: "edit", ideaPrompt: "Second", createdAt: new Date(), lastInteractionAt: new Date() },
      { id: "s1", stage: "idea", ideaPrompt: "First", createdAt: new Date(), lastInteractionAt: new Date() },
    ]);

    const sessions = await listResumableSessions("org_1", "user_1");

    expect(db.workspaceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orgId: "org_1", userId: "user_1" }),
      orderBy: { lastInteractionAt: "desc" },
      take: 5,
    }));
    expect(sessions).toHaveLength(2);
  });
});
