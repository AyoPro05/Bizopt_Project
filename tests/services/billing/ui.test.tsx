import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { BillingPanel } from "@/components/billing/billing-panel";
const props = { status: "pending_payment", userFacingState: "pending_payment", currentPeriodEnd: null, trialEndAt: null, cancelAtPeriodEnd: false, canRefund: false, plans: [{ key: "base" as const, label: "Base", capacity: 2, amountCents: 999, currency: "usd", interval: "month" as const }, { key: "team" as const, label: "Team", capacity: 5, amountCents: 1399, currency: "usd", interval: "month" as const }], selectedPlan: "base" as const, initialChoice: "base" as const, occupied: 1, reserved: 0, seatLimit: 2, hasSubscription: false, pendingPlan: null, pendingPlanEffectiveAt: null, requestedPlan: null, savedQuote: null, trialPriceCents: 99, trialDays: 7, teamConfigured: true, introductoryConfigured: true, verified: true };
let root: ReturnType<typeof createRoot> | undefined;
beforeEach(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; });
it("requires explicit consent before checkout and states the exact offer", async () => {
  const host = document.createElement("div"); root = createRoot(host); await act(async () => root!.render(<BillingPanel {...props} />));
  expect(host.textContent).toContain("$0.99 today for 7 days, then $9.99/month until canceled.");
  const button = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Continue with")); expect(button?.disabled).toBe(true);
  const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]'); expect(checkbox).not.toBeNull(); await act(async () => checkbox!.click()); expect(button?.disabled).toBe(false);
});
it("labels paid introductory access and payment recovery truthfully", () => {
  const html = renderToStaticMarkup(<BillingPanel {...props} hasSubscription status="trialing" userFacingState="pending_payment" />);
  expect(html).toContain("Introductory payment awaiting confirmation"); expect(html).not.toContain("free trial");
  expect(renderToStaticMarkup(<BillingPanel {...props} hasSubscription status="past_due" userFacingState="grace_period" />)).toContain("Payment needs attention");
});
it("disables checkout until email and introductory price configuration are available", () => {
  const html = renderToStaticMarkup(<BillingPanel {...props} verified={false} introductoryConfigured={false} />); expect(html).toContain("Verify your email"); expect(html).toContain("currently unavailable");
});
