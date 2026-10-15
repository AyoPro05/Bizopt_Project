import { BILLING, COMMERCIAL_TERMS } from "@/lib/constants";
import { AppError } from "@/services/platform/errors";
import { getPlanDefinition, type PlanKey } from "./plans";
export type CheckoutConsent = { accepted: true; offerVersion: string; termsVersion: string; renewalDisclosureVersion: string; planKey: PlanKey; introductoryAmountMinor: number; introductoryDurationDays: number; recurringAmountMinor: number; currency: string };
export function consentSnapshot(plan: PlanKey) {
  return { ...COMMERCIAL_TERMS, planKey: plan, introductoryAmountMinor: BILLING.trialPriceCents, introductoryDurationDays: BILLING.trialDays, recurringAmountMinor: getPlanDefinition(plan).amountCents, currency: BILLING.currency };
}
export function assertCommercialConsent(plan: PlanKey, input: CheckoutConsent | undefined) {
  const expected = consentSnapshot(plan);
  if (!input || input.accepted !== true || Object.entries(expected).some(([key, value]) => input[key as keyof CheckoutConsent] !== value)) throw new AppError("Accept the current introductory and automatic renewal terms; the commercial consent does not match this offer", 400);
  return expected;
}
