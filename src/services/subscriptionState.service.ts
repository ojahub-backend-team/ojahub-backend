import SubscriptionModel from "../models/subscription.model.js";
import UserModel from "../models/user.model.js";
import {
  PLANS,
  SUBSCRIPTION_PLAN_IDS,
  FREE_TRIAL_PLAN_ID,
  TRIAL_DAYS,
  type PlanId,
} from "../config/plans.js";
import {
  toSubscriptionDto,
  type SubscriptionDto,
} from "./subscription.service.js";
import type { SubscriptionStatus } from "../utils/subscriptionStatus.js";

export type SubscriptionState = {
  status: SubscriptionStatus | "none";
  canWrite: boolean;
  subscription: SubscriptionDto | null;
};

export const getSubscriptionStateForBusiness = async (
  businessId: string,
): Promise<SubscriptionState> => {
  const sub = await SubscriptionModel.findOne({ businessId });

  if (!sub) {
    return {
      status: "none",
      canWrite: false,
      subscription: null,
    };
  }

  const dto = toSubscriptionDto(sub);

  return {
    status: dto.status,
    canWrite: dto.status !== "expired",
    subscription: dto,
  };
};

type StateResult =
  | { success: true; state: SubscriptionState }
  | { success: false; status: number; message: string };

export const getSubscriptionStateForUserService = async (
  userId: string,
): Promise<StateResult> => {
  const user = await UserModel.findById(userId).select("businessId");

  if (!user) {
    return {
      success: false,
      status: 404,
      message: "User not found",
    };
  }

  if (!user.businessId) {
    return {
      success: false,
      status: 403,
      message: "Add your business details first",
    };
  }

  const state = await getSubscriptionStateForBusiness(
    user.businessId.toString(),
  );

  return { success: true, state };
};

export const listPlans = () => ({
  trialDays: TRIAL_DAYS,
  plans: SUBSCRIPTION_PLAN_IDS.map((id) => {
    if (id === FREE_TRIAL_PLAN_ID) {
      return {
        id,
        label: "Free Trial",
        priceKobo: 0,
        months: 0,
      };
    }

    const paidPlan = PLANS[id as PlanId];

    return {
      id,
      label: paidPlan.label,
      priceKobo: paidPlan.priceKobo,
      months: paidPlan.months,
    };
  }),
});
