import SubscriptionModel from "../models/subscription.model.js";
import PaymentModel from "../models/payment.model.js";
import UserModel from "../models/user.model.js";
import {
  FREE_TRIAL_PLAN_ID,
  PLANS,
  TRIAL_DAYS,
  type PlanId,
  type SubscriptionPlanId,
} from "../config/plans.js";
import {
  getSubscriptionStatus,
  daysLeft,
  type SubscriptionStatus,
} from "../utils/subscriptionStatus.js";
import {
  initializeSubscriptionPaymentService,
  PaymentServiceError,
} from "./payment.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionDto = {
  plan: SubscriptionPlanId;
  planLabel: string;
  priceKobo: number;
  status: SubscriptionStatus;
  endsAt: Date;
  daysLeft: number;
};

type SubscriptionLike = {
  plan: SubscriptionPlanId;
  priceKobo: number;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
};

export const toSubscriptionDto = (
  sub: SubscriptionLike,
  now: Date = new Date(),
): SubscriptionDto => {
  const status = getSubscriptionStatus(sub, now);

  const endsAt = sub.currentPeriodEnd ?? sub.trialEndsAt ?? now;

  return {
    plan: sub.plan,
    planLabel:
      sub.plan === FREE_TRIAL_PLAN_ID
        ? "Free Trial"
        : PLANS[sub.plan as PlanId].label,
    priceKobo: sub.priceKobo,
    status,
    endsAt,
    daysLeft: daysLeft(endsAt, now),
  };
};

type ChoosePlanResult =
  | {
      success: true;
      type: "trial";
      message: string;
      subscription: SubscriptionDto;
      onboardingStep: number;
    }
  | {
      success: true;
      type: "payment";
      message: string;
      payment: Awaited<ReturnType<typeof initializeSubscriptionPaymentService>>;
      onboardingStep: number;
    }
  | {
      success: false;
      status: number;
      message: string;
    };

export const choosePlanService = async (
  userId: string,
  planId: SubscriptionPlanId,
): Promise<ChoosePlanResult> => {
  const user = await UserModel.findById(userId).select(
    "businessId onboardingStep",
  );

  if (!user) {
    return {
      success: false,
      status: 404,
      message: "User not found.",
    };
  }

  if (!user.businessId) {
    return {
      success: false,
      status: 403,
      message: "Add your business details first.",
    };
  }

  if (user.onboardingStep < 3) {
    return {
      success: false,
      status: 400,
      message: "Finish the earlier setup steps before choosing a plan.",
    };
  }

  const businessId = user.businessId;

  const pendingPayment = await PaymentModel.findOne({
    businessId,
    status: "pending",
  });

  if (pendingPayment) {
    return {
      success: false,
      status: 409,
      message:
        "You already have a pending payment. Complete or resolve it before selecting another plan.",
    };
  }

  const existing = await SubscriptionModel.findOne({ businessId });
  const now = new Date();

  if (existing) {
    const status = getSubscriptionStatus(existing, now);

    if (status === "active") {
      return {
        success: false,
        status: 409,
        message: "Your subscription is already active.",
      };
    }

    if (status === "trialing") {
      return {
        success: false,
        status: 409,
        message:
          "Your free trial is still active. You can choose a paid plan after it expires.",
      };
    }

    // An existing expired subscription means the user has already
    // used their trial or previously had a paid subscription.
    if (planId === FREE_TRIAL_PLAN_ID) {
      return {
        success: false,
        status: 409,
        message:
          "Your free trial cannot be restarted. Please choose a paid plan.",
      };
    }
  }

  if (planId !== FREE_TRIAL_PLAN_ID) {
    try {
      const payment = await initializeSubscriptionPaymentService(
        userId,
        planId as PlanId,
      );

      return {
        success: true,
        type: "payment",
        message: "Continue to Paystack to complete your payment.",
        payment,
        onboardingStep: user.onboardingStep,
      };
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return {
          success: false,
          status: error.statusCode,
          message: error.message,
        };
      }

      throw error;
    }
  }

  const trialStartedAt = now;
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);

  let subscription;

  try {
    subscription = await SubscriptionModel.findOneAndUpdate(
      { businessId },
      {
        $setOnInsert: {
          plan: FREE_TRIAL_PLAN_ID,
          priceKobo: 0,
          trialStartedAt,
          trialEndsAt,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return {
        success: false,
        status: 409,
        message: "A subscription already exists for this business.",
      };
    }

    throw error;
  }

  if (!subscription) {
    throw new Error("Could not start the free trial.");
  }

  await UserModel.updateOne({ _id: user._id }, { $max: { onboardingStep: 4 } });

  return {
    success: true,
    type: "trial",
    message: "Your 7-day free trial has started.",
    subscription: toSubscriptionDto(subscription),
    onboardingStep: 4,
  };
};
