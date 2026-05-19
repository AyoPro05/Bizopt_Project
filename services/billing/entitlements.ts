import { db } from "@/lib/db";
import type { UserFacingState } from "@/lib/constants";
import { DEVICE_LIMIT_DEFAULT } from "@/lib/constants";

export async function upsertEntitlement(
  orgId: string,
  data: {
    subscriptionId?: string;
    active: boolean;
    accessUntil?: Date | null;
    userFacingState: UserFacingState;
    deviceLimit?: number;
  }
) {
  return db.entitlement.upsert({
    where: { orgId },
    create: {
      orgId,
      subscriptionId: data.subscriptionId,
      active: data.active,
      accessUntil: data.accessUntil,
      userFacingState: data.userFacingState,
      deviceLimit: data.deviceLimit ?? DEVICE_LIMIT_DEFAULT,
    },
    update: {
      subscriptionId: data.subscriptionId,
      active: data.active,
      accessUntil: data.accessUntil,
      userFacingState: data.userFacingState,
      deviceLimit: data.deviceLimit,
    },
  });
}

export async function activateTrialing(
  orgId: string,
  subscriptionId: string,
  trialEnd: Date | null
) {
  return upsertEntitlement(orgId, {
    subscriptionId,
    active: true,
    accessUntil: trialEnd,
    userFacingState: "trialing",
  });
}

export async function revokeEntitlement(orgId: string, state: UserFacingState = "canceled") {
  return upsertEntitlement(orgId, {
    active: false,
    accessUntil: new Date(),
    userFacingState: state,
  });
}

export async function activateEntitlement(
  orgId: string,
  subscriptionId: string,
  accessUntil?: Date | null
) {
  return upsertEntitlement(orgId, {
    subscriptionId,
    active: true,
    accessUntil: accessUntil ?? null,
    userFacingState: "active",
  });
}

export async function setGracePeriod(orgId: string, graceUntil: Date) {
  return upsertEntitlement(orgId, {
    active: true,
    accessUntil: graceUntil,
    userFacingState: "grace_period",
  });
}

export async function setPastDue(orgId: string, subscriptionId: string) {
  return upsertEntitlement(orgId, {
    subscriptionId,
    active: false,
    userFacingState: "past_due",
  });
}

export async function setTrialEnded(orgId: string) {
  return upsertEntitlement(orgId, {
    active: false,
    userFacingState: "trial_ended",
  });
}
