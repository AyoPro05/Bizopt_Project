import { describe, expect, it } from "vitest";
import { isPrivateIdentityPath, shouldDropIdentityTelemetry } from "@/lib/identity-privacy";
describe("identity page telemetry boundary", () => {
  it("excludes recovery and verification routes including API variants", () => {
    for (const path of ["/verify-email", "/reset-password", "/forgot-password", "/check-email", "/api/auth/verify-email?token=secret", "/api/auth/password-reset/confirm", "/api/account/email/confirm"]) expect(isPrivateIdentityPath(path)).toBe(true);
    expect(isPrivateIdentityPath("/home")).toBe(false);
  });
  it("drops token-route request events without relying only on query redaction", () => {
    expect(shouldDropIdentityTelemetry({ request: { url: "https://app.example.test/reset-password#secret" } })).toBe(true);
    expect(shouldDropIdentityTelemetry({ request: { url: "https://app.example.test/home" } })).toBe(false);
  });
});
