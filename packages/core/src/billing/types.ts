export type EntitlementState =
  | "active"
  | "trialing"
  | "trial_ended"
  | "past_due"
  | "canceled"
  | "grace_period"
  | "refunded";

export type SubscriptionSnapshot = {
  orgId: string;
  state: EntitlementState;
  active: boolean;
  accessUntil?: string;
  deviceLimit: number;
  priceCents: number;
  currency: string;
};
