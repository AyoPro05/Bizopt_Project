// @vitest-environment node
import { describe, expect, it } from "vitest";
import { safeInternalDestination } from "@/lib/redirect-url";
import { cookieMutationOriginAllowed } from "@/lib/cookie-origin";
import { scrubMonitoringEvent } from "@/lib/monitoring-privacy";
const origin = "https://app.example.test";
describe("account integration boundaries", () => {
  it("preserves selected plans and rejects cross-origin or authentication loop destinations", () => {
    expect(safeInternalDestination("/billing?plan=team", origin)).toBe("/billing?plan=team");
    for (const path of ["https://evil.test/billing", "//evil.test", "/\\evil.test", "/api/account", "/login", "/billing?plan=team&token=private", "/home?password=private"]) expect(safeInternalDestination(path, origin)).toBe("/ai-studio");
  });
  it("requires the expected origin for cookie mutations even with an arbitrary bearer", () => {
    const req = (extra: HeadersInit) => new Request(`${origin}/api/devices/rebind`, { method: "POST", headers: { cookie: "__Secure-next-auth.session-token=value", authorization: "Bearer arbitrary", ...extra } });
    expect(cookieMutationOriginAllowed(req({ origin }))).toBe(true);
    expect(cookieMutationOriginAllowed(req({ origin: "https://evil.test" }))).toBe(false);
    expect(cookieMutationOriginAllowed(req({}))).toBe(false);
    expect(cookieMutationOriginAllowed(new Request(`${origin}/api/account`, { method: "POST", headers: { authorization: "Bearer bound-session" } }))).toBe(true);
  });
  it("removes invite fragments, form bodies and identities from monitoring without mutating the original", () => {
    const event = { request: { url: `${origin}/invite?id=private#token=secret`, data: { password: "private" }, headers: { cookie: "secret" } }, user: { email: "private" }, breadcrumbs: [{ data: { from: "/invite#secret", to: "/support?customer=private" } }] };
    const safe = scrubMonitoringEvent(event);
    expect(JSON.stringify(safe)).not.toMatch(/private|secret/);
    expect(safe.request.url).toBe(`${origin}/invite`);
    expect(event.request.url).toContain("secret");
  });
});
