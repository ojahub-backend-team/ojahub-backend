import SubscriptionModel from "../models/subscription.model.js";
import UserModel from "../models/user.model.js";
import { PLANS, TRIAL_DAYS, type PlanId } from "../config/plans.js";
import {
  getSubscriptionStatus,
  daysLeft,
  type SubscriptionStatus,
} from "../utils/subscriptionStatus.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionDto = {
  plan: PlanId;
  planLabel: string;
  priceKobo: number;
  status: SubscriptionStatus;
  endsAt: Date;
  daysLeft: number;
};

type SubscriptionLike = {
  plan: PlanId;
  priceKobo: number;
  trialEndsAt: Date;
  currentPeriodEnd?: Date | null;
};

export const toSubscriptionDto = (
  sub: SubscriptionLike,
  now: Date = new Date(),
): SubscriptionDto => {
  const status = getSubscriptionStatus(sub, now);
  const endsAt =
    status === "active" && sub.currentPeriodEnd
      ? sub.currentPeriodEnd
      : sub.trialEndsAt;

  return {
    plan: sub.plan,
    planLabel: PLANS[sub.plan].label,
    priceKobo: sub.priceKobo,
    status,
    endsAt,
    daysLeft: daysLeft(endsAt, now),
  };
};

type ChoosePlanResult =
  | {
      success: true;
      message: string;
      subscription: SubscriptionDto;
      onboardingStep: number;
    }
  | { success: false; status: number; message: string };

export const choosePlanService = async (
  userId: string,
  planId: PlanId,
): Promise<ChoosePlanResult> => {
  const user = await UserModel.findById(userId).select(
    "businessId onboardingStep",
  );

  if (!user) {
    return { success: false, status: 404, message: "User not found" };
  }

  if (!user.businessId) {
    return {
      success: false,
      status: 403,
      message: "Add your business details first",
    };
  }

  // Step 3 may be skipped, but it leaves the step at 3, so 3 is the minimum
  if (user.onboardingStep < 3) {
    return {
      success: false,
      status: 400,
      message: "Finish the earlier setup steps before choosing a plan",
    };
  }

  const existing = await SubscriptionModel.findOne({
    businessId: user.businessId,
  });

  // Only a running trial can be changed here. Later changes belong to billing.
  if (existing && getSubscriptionStatus(existing) !== "trialing") {
    return {
      success: false,
      status: 409,
      message:
        "Your subscription has already started. Change your plan from the billing screen.",
    };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
  const plan = PLANS[planId];

  // $setOnInsert only runs when the record is created, so choosing a plan again
  // changes the plan but never restarts or extends the trial.
  const save = () =>
    SubscriptionModel.findOneAndUpdate(
      { businessId: user.businessId },
      {
        $set: { plan: planId, priceKobo: plan.priceKobo },
        $setOnInsert: { trialStartedAt: now, trialEndsAt },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

  let subscription;
  try {
    subscription = await save();
  } catch (error) {
    // Two requests created the record at the same moment: the second one retries as an update
    if ((error as { code?: number }).code === 11000) {
      subscription = await save();
    } else {
      throw error;
    }
  }

  if (!subscription) {
    throw new Error("Could not save the subscription");
  }

  // Progress only goes up
  await UserModel.updateOne({ _id: user._id }, { $max: { onboardingStep: 4 } });

  return {
    success: true,
    message: existing ? "Plan updated" : "Free trial started",
    subscription: toSubscriptionDto(subscription),
    onboardingStep: 4,
  };
};
