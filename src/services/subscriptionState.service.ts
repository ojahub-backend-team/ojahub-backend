import SubscriptionModel from "../models/subscription.model.js";
import UserModel from "../models/user.model.js";
import { PLANS, PLAN_IDS, TRIAL_DAYS } from "../config/plans.js";
import {
  toSubscriptionDto,
  type SubscriptionDto,
} from "./subscription.service.js";
import type { SubscriptionStatus } from "../utils/subscriptionStatus.js";

export type SubscriptionState = {
  // "none" means the trader has not chosen a plan yet (step 4)
  status: SubscriptionStatus | "none";
  canWrite: boolean;
  subscription: SubscriptionDto | null;
};

// One place decides whether a business may write.
// The expiry gate will use this same function.
export const getSubscriptionStateForBusiness = async (
  businessId: string,
): Promise<SubscriptionState> => {
  const sub = await SubscriptionModel.findOne({ businessId });

  if (!sub) {
    return { status: "none", canWrite: false, subscription: null };
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
  // The business ID always comes from the user record, never from the request
  const user = await UserModel.findById(userId).select("businessId");

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

  const state = await getSubscriptionStateForBusiness(
    user.businessId.toString(),
  );

  return { success: true, state };
};

export const listPlans = () => ({
  trialDays: TRIAL_DAYS,
  plans: PLAN_IDS.map((id) => ({
    id,
    label: PLANS[id].label,
    priceKobo: PLANS[id].priceKobo,
    months: PLANS[id].months,
  })),
});
