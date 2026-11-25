export type SubscriptionStatus = "trialing" | "active" | "expired";

type DatedSubscription = {
  trialEndsAt: Date;
  currentPeriodEnd?: Date | null;
};

// Status is worked out from the dates every time it is needed.
// There is no status flag to forget to update, abd no cron job.
export const getSubscriptionStatus = (
  sub: DatedSubscription,
  now: Date = new Date(),
): SubscriptionStatus => {
  if (sub.currentPeriodEnd && now.getTime() < sub.currentPeriodEnd.getTime()) {
    return "active";
  }
  if (now.getTime() < sub.trialEndsAt.getTime()) {
    return "trialing";
  }
  return "expired";
};

export const daysLeft = (endsAt: Date, now: Date = new Date()): number =>
  Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000));
