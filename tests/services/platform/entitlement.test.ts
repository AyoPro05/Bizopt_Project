import { describe, expect, it, vi } from "vitest";
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { entitlement: { findUnique } } }));
import { requireActiveEntitlement } from "@/lib/permissions";
describe("effective access boundaries", () => {
  it("ends grace access at its stored deadline without requiring a later webhook", async () => {
    findUnique.mockResolvedValue({ active: true, userFacingState: "grace_period", accessUntil: new Date(Date.now()-1000) });
    expect(await requireActiveEntitlement("org")).toBe(false);
    findUnique.mockResolvedValue({ active: true, userFacingState: "grace_period", accessUntil: new Date(Date.now()+60000) });
    expect(await requireActiveEntitlement("org")).toBe(true);
  });
  it("does not grant access from a stale label after explicit suspension", async () => {
    findUnique.mockResolvedValue({ active: false, userFacingState: "active", accessUntil: null });
    expect(await requireActiveEntitlement("org")).toBe(false);
  });
});
