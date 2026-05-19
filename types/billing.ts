import type { UserFacingState } from "@/lib/constants";

export type BillingSummary = {
  status: string;
  userFacingState: UserFacingState;
  displayPrice: string;
  currency: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canRefund: boolean;
  deviceLimit: number;
  deviceCount: number;
};
