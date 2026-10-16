// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { POST } from "@/app/api/auth/signup/route";
import { disposableTestDatabase } from "@/scripts/test-database-config.mjs";

const url = disposableTestDatabase(process.env.AUTOMATION_TEST_DATABASE_URL);
const enabled = !!url;
const suffix = randomUUID();
const origin = "https://app.example.test";
const email = `signup-regression-${suffix}@example.test`;
let userId = "", orgId = "";

describe.skipIf(!enabled)("signup HTTP transaction against PostgreSQL", () => {
  beforeAll(() => {
    if (process.env.DATABASE_URL !== url) throw new Error("Disposable database required");
    vi.stubEnv("APP_URL", origin);
    vi.stubEnv("NOTIFICATION_PAYLOAD_KEY", Buffer.alloc(32, 11).toString("base64"));
  });
  afterAll(async () => {
    if (orgId) await db.organization.delete({ where: { id: orgId } });
    if (userId) await db.user.delete({ where: { id: userId } });
    vi.unstubAllEnvs();
  });
  it("creates the account and encrypted verification intent through the actual signup handler", async () => {
    const response = await POST(new Request(`${origin}/api/auth/signup`, {
      method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": `2001:db8::${suffix.slice(0, 4)}` },
      body: JSON.stringify({ name: "Signup regression", email, password: "Fixture-password-42", callbackUrl: "/billing?plan=team" }),
    }));
    const user = await db.user.findUnique({ where: { email }, include: { memberships: { include: { org: { include: { entitlement: true } } } } } });
    if (user) { userId = user.id; orgId = user.memberships[0].orgId; }
    expect(response.status).toBe(201);
    expect(user?.emailVerified).toBeNull();
    expect(user?.memberships[0].org.entitlement?.active).toBe(false);
    const proof = await db.identityToken.findFirstOrThrow({ where: { userId, purpose: "EMAIL_VERIFICATION" } });
    const event = await db.outboxEvent.findFirstOrThrow({ where: { userId, eventType: "identity.verification_requested" } });
    expect(proof.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.secretPayloadEnc).toBeTruthy();
    expect(event.payloadJson).toMatchObject({ callbackUrl: "/billing?plan=team" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
