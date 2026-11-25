export const PLAN_IDS = ["monthly", "six_months", "yearly"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

// Subscription plans include both the free trial and paid plans.
export const SUBSCRIPTION_PLAN_IDS = ["free_trial", ...PLAN_IDS] as const;

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLAN_IDS)[number];

export const FREE_TRIAL_PLAN_ID = "free_trial" as const;

export const PLANS: Record<
  PlanId,
  { label: string; priceKobo: number; months: number }
> = {
  monthly: { label: "Monthly", priceKobo: 500000, months: 1 },
  six_months: { label: "6 months", priceKobo: 2700000, months: 6 },
  yearly: { label: "Yearly", priceKobo: 4800000, months: 12 },
};

export const TRIAL_DAYS = 7;
