import { describe, expect, it } from "vitest";
import { createIdentitySecret, hashIdentityToken, validIdentityProof } from "@/services/identity/tokens";
import { passwordInput, registrationInput, resetInput } from "@/services/identity/schemas";

describe("identity proof security", () => {
  it("generates independent 256-bit secrets and stores only deterministic SHA256 hashes", () => {
    const a = createIdentitySecret(); const b = createIdentitySecret();
    expect(a.token).toMatch(/^[a-f0-9]{64}$/); expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashIdentityToken(a.token)); expect(a.tokenHash).not.toBe(a.token);
    expect(JSON.stringify({ tokenHash: a.tokenHash })).not.toContain(a.token);
  });
  it("rejects wrong purpose, wrong intended email, expired, reused and tampered proofs", () => {
    const secret = createIdentitySecret(); const now = new Date();
    const row = { id: "proof", userId: "u", purpose: "EMAIL_VERIFICATION", targetEmail: "person@example.com", tokenHash: secret.tokenHash, expiresAt: new Date(+now + 1000), consumedAt: null };
    expect(validIdentityProof(row, { id: "proof", token: secret.token }, "EMAIL_VERIFICATION", "person@example.com", now)).toBe(true);
    for (const changed of [{ purpose: "PASSWORD_RESET" }, { targetEmail: "other@example.com" }, { expiresAt: now }, { consumedAt: now }, { tokenHash: "0".repeat(64) }, { userId: "" }]) {
      expect(validIdentityProof({ ...row, ...changed }, { id: "proof", token: secret.token }, "EMAIL_VERIFICATION", "person@example.com", now)).toBe(false);
    }
    expect(validIdentityProof(row, { id: "proof", token: "x" }, "EMAIL_VERIFICATION", "person@example.com", now)).toBe(false);
  });
  it("rejects unknown signup keys, oversized input and bcrypt-truncated passwords", () => {
    expect(registrationInput.safeParse({ name: "A", email: "a@example.com", password: "long-password", verified: true }).success).toBe(false);
    expect(passwordInput.safeParse("é".repeat(37)).success).toBe(false);
    expect(passwordInput.safeParse("a".repeat(73)).success).toBe(false);
    expect(passwordInput.safeParse("a".repeat(72)).success).toBe(true);
  });
  it("requires matching reset passwords and a precisely bounded proof", () => {
    expect(resetInput.safeParse({ id: "p", token: "a".repeat(64), password: "new-password", confirmPassword: "different" }).success).toBe(false);
    expect(resetInput.safeParse({ id: "p", token: "a".repeat(65), password: "new-password", confirmPassword: "new-password" }).success).toBe(false);
  });
});
