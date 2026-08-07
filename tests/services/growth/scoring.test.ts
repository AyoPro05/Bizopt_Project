import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    ideaBrief: { count: vi.fn() },
    campaign: { count: vi.fn() },
    entitlement: { findUnique: vi.fn() },
    growthPrediction: { findFirst: vi.fn() },
    growthRecommendation: { findMany: vi.fn() },
    subscription: { findUnique: vi.fn() },
    device: { count: vi.fn() },
    complianceCheck: { count: vi.fn() },
  },
}));

vi.mock("@/lib/platform-accounts", () => ({
  countConnectedPlatforms: vi.fn(),
}));

vi.mock("@/services/analytics", () => ({
  getOrgAnalytics: vi.fn(),
}));

describe("computeGrowthScore", () => {
  let mockDb: any;
  let mockAnalytics: any;
  let mockPlatforms: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockDb = (await import("@/lib/db")).db;
    mockAnalytics = (await import("@/services/analytics")).getOrgAnalytics;
    mockPlatforms = (await import("@/lib/platform-accounts")).countConnectedPlatforms;
  });

  it("should return base score of 40 with zero activity", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 0 } });
    mockDb.ideaBrief.count.mockResolvedValue(0);
    mockDb.campaign.count.mockResolvedValue(0);
    mockDb.entitlement.findUnique.mockResolvedValue({ active: false, userFacingState: "pending_payment" });

    const score = await computeGrowthScore("org-123");
    expect(score).toBe(40);
  });

  it("should cap brief count bonus at 20 points", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 0 } });
    mockDb.ideaBrief.count.mockResolvedValue(100); // well over cap
    mockDb.campaign.count.mockResolvedValue(0);
    mockDb.entitlement.findUnique.mockResolvedValue({ active: false, userFacingState: "pending_payment" });

    const score = await computeGrowthScore("org-123");
    // 40 base + 20 (capped from 100*4=400) = 60
    expect(score).toBe(60);
  });

  it("should cap campaign count bonus at 15 points", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 0 } });
    mockDb.ideaBrief.count.mockResolvedValue(0);
    mockDb.campaign.count.mockResolvedValue(100); // well over cap
    mockDb.entitlement.findUnique.mockResolvedValue({ active: false, userFacingState: "pending_payment" });

    const score = await computeGrowthScore("org-123");
    // 40 base + 15 (capped from 100*5=500) = 55
    expect(score).toBe(55);
  });

  it("should give +5 for trial status", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 0 } });
    mockDb.ideaBrief.count.mockResolvedValue(0);
    mockDb.campaign.count.mockResolvedValue(0);
    mockDb.entitlement.findUnique.mockResolvedValue({ active: false, userFacingState: "trialing" });

    const score = await computeGrowthScore("org-123");
    expect(score).toBe(45);
  });

  it("should give +5 for active entitlement", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 0 } });
    mockDb.ideaBrief.count.mockResolvedValue(0);
    mockDb.campaign.count.mockResolvedValue(0);
    mockDb.entitlement.findUnique.mockResolvedValue({ active: true, userFacingState: "active" });

    const score = await computeGrowthScore("org-123");
    expect(score).toBe(45);
  });

  it("should cap success rate contribution at 20 points", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 100 } }); // 100 * 0.2 = 20 (capped)
    mockDb.ideaBrief.count.mockResolvedValue(0);
    mockDb.campaign.count.mockResolvedValue(0);
    mockDb.entitlement.findUnique.mockResolvedValue({ active: false, userFacingState: "pending_payment" });

    const score = await computeGrowthScore("org-123");
    // 40 base + 0 + 0 + 20 (capped) + 0 = 60
    expect(score).toBe(60);
  });

  it("should never exceed 100", async () => {
    const { computeGrowthScore } = await import("@/services/growth/scoring");

    mockAnalytics.mockResolvedValue({ summary: { successRate: 100 } });
    mockDb.ideaBrief.count.mockResolvedValue(50);
    mockDb.campaign.count.mockResolvedValue(50);
    mockDb.entitlement.findUnique.mockResolvedValue({ active: true, userFacingState: "active" });

    const score = await computeGrowthScore("org-123");
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("computeBusinessHealthScore", () => {
  let mockDb: any;
  let mockPlatforms: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockDb = (await import("@/lib/db")).db;
    mockPlatforms = (await import("@/lib/platform-accounts")).countConnectedPlatforms;
  });

  it("should return base score of 50 with no data", async () => {
    const { computeBusinessHealthScore } = await import("@/services/growth/scoring");

    mockDb.subscription.findUnique.mockResolvedValue(null);
    mockDb.device.count.mockResolvedValue(0);
    mockPlatforms.mockResolvedValue(0);
    mockDb.complianceCheck.count.mockResolvedValue(0);

    const score = await computeBusinessHealthScore("org-123");
    expect(score).toBe(50);
  });

  it("should give +20 for active subscription", async () => {
    const { computeBusinessHealthScore } = await import("@/services/growth/scoring");

    mockDb.subscription.findUnique.mockResolvedValue({ status: "active" });
    mockDb.device.count.mockResolvedValue(0);
    mockPlatforms.mockResolvedValue(0);
    mockDb.complianceCheck.count.mockResolvedValue(0);

    const score = await computeBusinessHealthScore("org-123");
    expect(score).toBe(70);
  });

  it("should give +10 for devices", async () => {
    const { computeBusinessHealthScore } = await import("@/services/growth/scoring");

    mockDb.subscription.findUnique.mockResolvedValue(null);
    mockDb.device.count.mockResolvedValue(2);
    mockPlatforms.mockResolvedValue(0);
    mockDb.complianceCheck.count.mockResolvedValue(0);

    const score = await computeBusinessHealthScore("org-123");
    expect(score).toBe(60);
  });

  it("should give +15 for connected platforms", async () => {
    const { computeBusinessHealthScore } = await import("@/services/growth/scoring");

    mockDb.subscription.findUnique.mockResolvedValue(null);
    mockDb.device.count.mockResolvedValue(0);
    mockPlatforms.mockResolvedValue(3);
    mockDb.complianceCheck.count.mockResolvedValue(0);

    const score = await computeBusinessHealthScore("org-123");
    expect(score).toBe(65);
  });

  it("should penalize compliance failures (-8 each)", async () => {
    const { computeBusinessHealthScore } = await import("@/services/growth/scoring");

    mockDb.subscription.findUnique.mockResolvedValue({ status: "active" });
    mockDb.device.count.mockResolvedValue(0);
    mockPlatforms.mockResolvedValue(0);
    mockDb.complianceCheck.count.mockResolvedValue(3);

    const score = await computeBusinessHealthScore("org-123");
    // 50 + 20 - 24 = 46
    expect(score).toBe(46);
  });

  it("should never go below 0", async () => {
    const { computeBusinessHealthScore } = await import("@/services/growth/scoring");

    mockDb.subscription.findUnique.mockResolvedValue(null);
    mockDb.device.count.mockResolvedValue(0);
    mockPlatforms.mockResolvedValue(0);
    mockDb.complianceCheck.count.mockResolvedValue(20); // -160 penalty

    const score = await computeBusinessHealthScore("org-123");
    expect(score).toBe(0);
  });
});
