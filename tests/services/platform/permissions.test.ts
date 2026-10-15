import { describe, expect, it } from "vitest";
import { hasCapability } from "@/lib/platform-permissions";
describe("central platform permissions", () => {
  it("denies member billing, owner and invitation actions", () => {
    expect(hasCapability("member", "workspace.read")).toBe(true);
    expect(hasCapability("member", "billing.manage")).toBe(false);
    expect(hasCapability("member", "workspace.invite")).toBe(false);
    expect(hasCapability("admin", "workspace.owner")).toBe(false);
  });
  it("fails closed for unknown roles", () => {
    expect(hasCapability("support_admin", "billing.manage")).toBe(false);
    expect(hasCapability("unknown", "content.write")).toBe(false);
  });
});
