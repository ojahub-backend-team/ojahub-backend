export type SubscriptionStatus = "trialing" | "active" | "expired";

type DatedSubscription = {
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
};

export const getSubscriptionStatus = (
  sub: DatedSubscription,
  now: Date = new Date(),
): SubscriptionStatus => {
  if (sub.currentPeriodEnd && now.getTime() < sub.currentPeriodEnd.getTime()) {
    return "active";
  }

  if (sub.trialEndsAt && now.getTime() < sub.trialEndsAt.getTime()) {
    return "trialing";
  }

  return "expired";
};

export const daysLeft = (endsAt: Date, now: Date = new Date()): number =>
  Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000));
