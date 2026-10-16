// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { disposableTestDatabase } from "@/scripts/test-database-config.mjs";

const identity = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("next-auth", () => ({ getServerSession: async () => identity.userId ? { user: { id: identity.userId } } : null }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { db } from "@/lib/db";
import { GET, PATCH } from "@/app/api/workspace/[id]/route";
import { POST as completeStage } from "@/app/api/workspace/[id]/complete-stage/route";
import { POST as createSession } from "@/app/api/workspace/sessions/route";
import { resumeFromSnapshot } from "@/services/workspace/session";
import { getSnapshot, getSnapshotHistory, saveWorkspaceSnapshot } from "@/services/workspace/snapshots";

const url = disposableTestDatabase(process.env.PLATFORM_TEST_DATABASE_URL);
const enabled = !!url;
const origin = "https://app.example.test";
const suffix = randomUUID();
const users: string[] = [], orgs: string[] = [];
let owner: string, colleague: string, outsider: string, orgId: string, foreignOrg: string;
let sessionId: string, foreignVariant: string, ownVariant: string, foreignAsset: string;
const params = () => ({ params: Promise.resolve({ id: sessionId }) });
function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/workspace/${sessionId}`, {
    method, headers: { origin, "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const current = () => db.workspaceSession.findUniqueOrThrow({ where: { id: sessionId } });
const snapshotCount = () => db.workspaceSnapshot.count({ where: { workspaceSessionId: sessionId } });

describe.skipIf(!enabled)("workspace editor security against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== url) throw new Error("Disposable database required");
    vi.stubEnv("SEO_APP_ORIGIN", origin);
    for (const name of ["owner", "colleague", "outsider"]) {
      users.push((await db.user.create({ data: { email: `workspace-${name}-${suffix}@example.test`, emailVerified: new Date() } })).id);
    }
    [owner, colleague, outsider] = users;
    orgId = (await db.organization.create({ data: { name: "Editor test", slug: `editor-${suffix}`, members: { create: [{ userId: owner, role: "owner" }, { userId: colleague, role: "member" }] } } })).id;
    foreignOrg = (await db.organization.create({ data: { name: "Foreign test", slug: `foreign-editor-${suffix}`, members: { create: { userId: outsider, role: "owner" } } } })).id;
    orgs.push(orgId, foreignOrg);
    for (const [tenant, person] of [[orgId, owner], [foreignOrg, outsider]]) {
      const brief = await db.ideaBrief.create({ data: { orgId: tenant, userId: person, prompt: "Fixture idea", variants: { create: { orgId: tenant, type: "caption", title: "Fixture", body: "Private fixture content" } } }, include: { variants: true } });
      if (tenant === orgId) ownVariant = brief.variants[0].id; else foreignVariant = brief.variants[0].id;
    }
    foreignAsset = (await db.asset.create({ data: { orgId: foreignOrg, type: "image", url: "/fixture.png" } })).id;
  });
  beforeEach(async () => {
    identity.userId = owner;
    sessionId = (await db.workspaceSession.create({ data: { orgId, userId: owner, ideaPrompt: "Original idea" } })).id;
  });
  afterEach(async () => { if (sessionId) await db.workspaceSession.deleteMany({ where: { id: sessionId } }); });
  afterAll(async () => {
    for (const id of orgs) await db.organization.delete({ where: { id } });
    if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
    vi.unstubAllEnvs();
  });

  it("denies a foreign workspace edit without changing the record", async () => {
    identity.userId = outsider;
    const response = await PATCH(request("PATCH", { ideaPrompt: "Tampered" }), params());
    expect((await current()).ideaPrompt).toBe("Original idea");
    expect(response.status).toBe(404);
  });
  it("denies foreign stage completion without a snapshot or state change", async () => {
    identity.userId = outsider;
    const response = await completeStage(request("POST", { nextStage: "generate" }), params());
    expect(await snapshotCount()).toBe(0);
    expect((await current()).stage).toBe("idea");
    expect(response.status).toBe(404);
  });
  it("keeps personal editor sessions private from another member of the same workspace", async () => {
    identity.userId = colleague;
    expect((await GET(request("GET"), params())).status).toBe(404);
    expect((await PATCH(request("PATCH", { ideaPrompt: "Colleague edit" }), params())).status).toBe(404);
    expect((await current()).ideaPrompt).toBe("Original idea");
  });
  it("permits the current owner to read and edit their session", async () => {
    expect((await GET(request("GET"), params())).status).toBe(200);
    const response = await PATCH(request("PATCH", { ideaPrompt: "Approved edit", selectedVariantId: ownVariant }), params());
    expect(response.status).toBe(200);
    expect(await current()).toMatchObject({ ideaPrompt: "Approved edit", selectedVariantId: ownVariant, orgId, userId: owner });
  });
  it.each([{ orgId: "other" }, { userId: "other" }, { org: { connect: { id: "other" } } }, { publishedAt: "2026-10-16T00:00:00Z" }])("rejects server-owned fields and nested Prisma input %j", async input => {
    const response = await PATCH(request("PATCH", input), params()).catch(() => null);
    expect(response?.status).toBe(400);
    expect(await current()).toMatchObject({ ideaPrompt: "Original idea", orgId, userId: owner, publishedAt: null });
  });
  it("rejects foreign content and media references before changing state", async () => {
    for (const input of [{ selectedVariantId: foreignVariant }, { editingAssetIds: [foreignAsset] }]) {
      const response = await PATCH(request("PATCH", input), params());
      expect(response.status).toBe(404);
    }
    expect(await current()).toMatchObject({ selectedVariantId: null, editingAssetIds: [] });
  });
  it("rejects unrecognized stages and stage overrides in completion updates", async () => {
    for (const input of [{ nextStage: "invented" }, { nextStage: "generate", updates: { stage: "published" } }]) {
      expect((await completeStage(request("POST", input), params())).status).toBe(400);
    }
    expect(await snapshotCount()).toBe(0);
    expect((await current()).stage).toBe("idea");
  });
  it("commits the previous-state snapshot and authorized stage update together", async () => {
    const response = await completeStage(request("POST", { nextStage: "generate", updates: { businessGoal: "Launch" } }), params());
    expect(response.status).toBe(200);
    expect(await current()).toMatchObject({ stage: "generate", businessGoal: "Launch" });
    const snapshot = await db.workspaceSnapshot.findFirstOrThrow({ where: { workspaceSessionId: sessionId } });
    expect(snapshot.snapshotData).toMatchObject({ ideaPrompt: "Original idea", stage: "idea" });
  });
  it("rolls back the snapshot when the stage write fails", async () => {
    const occupied = await db.workspaceSession.create({ data: { orgId, userId: owner, ideaPrompt: "Other", selectedVariantId: ownVariant } });
    try {
      const response = await completeStage(request("POST", { nextStage: "generate", updates: { selectedVariantId: ownVariant } }), params()).catch(() => null);
      expect(await snapshotCount()).toBe(0);
      expect((await current()).stage).toBe("idea");
      expect(response?.status).toBe(409);
    } finally { await db.workspaceSession.delete({ where: { id: occupied.id } }); }
  });
  it("requires authentication and rejects invalid bearer credentials without cookie fallback", async () => {
    identity.userId = null;
    expect((await GET(request("GET"), params())).status).toBe(401);
    identity.userId = owner;
    expect((await GET(request("GET", undefined, { authorization: "Bearer invalid" }), params())).status).toBe(401);
  });
  it("rejects cross-origin and oversized mutations before writing", async () => {
    expect((await PATCH(request("PATCH", { ideaPrompt: "Tampered" }, { origin: "https://attacker.example" }), params())).status).toBe(403);
    expect((await PATCH(request("PATCH", { ideaPrompt: "x".repeat(40000) }), params())).status).toBe(413);
    expect((await current()).ideaPrompt).toBe("Original idea");
  });
  it("validates session creation rather than accepting an arbitrary body", async () => {
    expect((await createSession(request("POST", { ideaPrompt: "Valid idea", orgId: foreignOrg }))).status).toBe(400);
  });
  it("cannot restore a snapshot belonging to a different session", async () => {
    const foreign = await db.workspaceSession.create({ data: { orgId: foreignOrg, userId: outsider, ideaPrompt: "Foreign session" } });
    try {
      const snapshot = await db.workspaceSnapshot.create({ data: { workspaceSessionId: foreign.id, stage: "edit", snapshotData: { stage: "edit", ideaPrompt: "Foreign private text" }, reason: "fixture" } });
      const restored = await resumeFromSnapshot(sessionId, snapshot.id, { orgId, userId: owner }).catch(() => null);
      expect(restored).toBeNull();
      expect((await current()).ideaPrompt).toBe("Original idea");
      expect(await snapshotCount()).toBe(0);
    } finally { await db.workspaceSession.delete({ where: { id: foreign.id } }); }
  });
  it("scopes snapshot saves, history and reads to the current person and workspace", async () => {
    const ownScope = { orgId, userId: owner };
    const snapshot = await saveWorkspaceSnapshot(sessionId, ownScope);
    expect((await getSnapshot(snapshot.id, sessionId, ownScope)).id).toBe(snapshot.id);
    expect(await getSnapshotHistory(sessionId, ownScope)).toHaveLength(1);
    for (const scope of [{ orgId, userId: colleague }, { orgId: foreignOrg, userId: outsider }]) {
      await expect(saveWorkspaceSnapshot(sessionId, scope)).rejects.toThrow("not found");
      await expect(getSnapshot(snapshot.id, sessionId, scope)).rejects.toThrow("not found");
      expect(await getSnapshotHistory(sessionId, scope)).toHaveLength(0);
    }
    expect(await snapshotCount()).toBe(1);
    await PATCH(request("PATCH", { ideaPrompt: "Later edit", businessGoal: "Later goal", selectedVariantId: ownVariant, carouselState: { slides: [] } }), params());
    await resumeFromSnapshot(sessionId, snapshot.id, ownScope);
    expect(await current()).toMatchObject({ ideaPrompt: "Original idea", businessGoal: null, selectedVariantId: null, carouselState: null });
  });
  it("removes editor access immediately when workspace membership is removed", async () => {
    await db.orgMember.delete({ where: { orgId_userId: { orgId, userId: owner } } });
    try {
      const response = await PATCH(request("PATCH", { ideaPrompt: "Removed member" }), params());
      expect([400, 403, 404]).toContain(response.status);
      expect((await current()).ideaPrompt).toBe("Original idea");
    } finally { await db.orgMember.create({ data: { orgId, userId: owner, role: "owner" } }); }
  });
  it("denies direct browser-role access to private editor state", async () => {
    await db.$executeRawUnsafe('GRANT SELECT ON "WorkspaceSession", "WorkspaceSnapshot" TO seo_browser_check');
    const rows = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE seo_browser_check");
      return tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM "WorkspaceSession"`;
    });
    expect(rows[0].count).toBe(0);
  });
});
