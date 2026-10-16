import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invitationToken, tokenDigest, reservationLimit, canGrantRole, validateInviteIdentity } from "@/services/workspace/policy";

describe("invitation and seat policy", () => {
  beforeEach(() => vi.stubEnv("INVITE_TOKEN_SECRET", "fixture-secret-with-at-least-thirty-two-characters"));
  afterEach(() => vi.unstubAllEnvs());
  it("reconstructs an unpredictable token without storing its plaintext", () => {
    const token = invitationToken("invite-id", "random-generation");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token).toBe(invitationToken("invite-id", "random-generation"));
    expect(tokenDigest(token)).not.toBe(token);
    expect(invitationToken("invite-id", "new-generation")).not.toBe(token);
  });
  it("reserves only future Base capacity once a downgrade is scheduled", () => {
    expect(reservationLimit({ seatLimit: 5 }, { pendingPlan: "base" })).toBe(2);
    expect(reservationLimit({ seatLimit: 5 }, { pendingPlan: null })).toBe(5);
    expect(reservationLimit(null, null)).toBe(2);
  });
  it("prevents administrators from granting administrative or owner powers", () => {
    expect(canGrantRole("admin", "member")).toBe(true);
    expect(canGrantRole("admin", "admin")).toBe(false);
    expect(canGrantRole("owner", "owner")).toBe(false);
    expect(canGrantRole("member", "member")).toBe(false);
    expect(canGrantRole("owner", "admin")).toBe(true);
  });
  it("requires the matching verified identity without email enumeration", () => {
    expect(() => validateInviteIdentity("person@example.com", { email: "other@example.com", emailVerified: new Date() })).toThrow("verified");
    expect(() => validateInviteIdentity("person@example.com", { email: "person@example.com", emailVerified: null })).toThrow("verified");
    expect(() => validateInviteIdentity("person@example.com", { email: "PERSON@example.com", emailVerified: new Date() })).not.toThrow();
  });
});
