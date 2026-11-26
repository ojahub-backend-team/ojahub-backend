import mongoose from "mongoose";
import { randomBytes } from "crypto";
import PaymentModel from "../models/payment.model.js";
import SubscriptionModel from "../models/subscription.model.js";
import UserModel from "../models/user.model.js";
import { PLANS, type PlanId } from "../config/plans.js";
import logger from "../config/logger.js";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  PaystackServiceError,
} from "./paystack.service.js";
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
} from "../utils/email.js";

export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const day = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(day, lastDay));

  return result;
};

/**
 * Sends a payment failure email without blocking the payment response.
 */
const notifyPaymentFailure = async (payment: {
  userId: unknown;
  plan: PlanId;
  amountKobo: number;
  reference: string;
}): Promise<void> => {
  const user = await UserModel.findById(payment.userId).select("name email");

  if (!user) {
    throw new Error("User not found while sending payment failure email.");
  }

  await sendPaymentFailedEmail(user.email, {
    name: user.name,
    planLabel: PLANS[payment.plan].label,
    amountKobo: payment.amountKobo,
    reference: payment.reference,
  });
};

/**
 * Sends a payment success email without blocking the payment response.
 */
const notifyPaymentSuccess = async (
  payment: {
    userId: unknown;
    plan: PlanId;
    amountKobo: number;
    reference: string;
  },
  paidAt: Date,
  currentPeriodEnd: Date,
): Promise<void> => {
  const user = await UserModel.findById(payment.userId).select("name email");

  if (!user) {
    throw new Error("User not found while sending payment success email.");
  }

  await sendPaymentSuccessEmail(user.email, {
    name: user.name,
    planLabel: PLANS[payment.plan].label,
    amountKobo: payment.amountKobo,
    reference: payment.reference,
    paidAt,
    currentPeriodEnd,
  });
};

/**
 * Initializes a paid subscription payment through Paystack.
 */
export const initializeSubscriptionPaymentService = async (
  userId: string,
  plan: PlanId,
) => {
  const user = await UserModel.findById(userId).select("email businessId");

  if (!user) {
    throw new PaymentServiceError("User not found.", 404);
  }

  if (!user.businessId) {
    throw new PaymentServiceError(
      "Complete your business setup before making payment.",
      403,
    );
  }

  const selectedPlan = PLANS[plan];

  if (!selectedPlan) {
    throw new PaymentServiceError("Invalid subscription plan.");
  }

  const subscription = await SubscriptionModel.findOne({
    businessId: user.businessId,
  });

  const now = new Date();

  if (subscription?.currentPeriodEnd && now < subscription.currentPeriodEnd) {
    throw new PaymentServiceError("Your subscription is already active.", 409);
  }

  if (
    subscription?.plan === "free_trial" &&
    subscription.trialEndsAt &&
    now < subscription.trialEndsAt
  ) {
    throw new PaymentServiceError(
      "Your free trial is still active. You can pay after it expires.",
      409,
    );
  }

  const pendingPayment = await PaymentModel.findOne({
    businessId: user.businessId,
    status: "pending",
  });

  if (pendingPayment) {
    throw new PaymentServiceError(
      "You already have a pending payment. Complete or resolve it before starting another payment.",
      409,
    );
  }

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");

  const uniqueCode = randomBytes(4).toString("hex").toUpperCase();
  const reference = `OJA-${date}-${uniqueCode}`;

  const payment = await PaymentModel.create({
    userId: user._id,
    businessId: user.businessId,
    plan,
    amountKobo: selectedPlan.priceKobo,
    reference,
    status: "pending",
  });

  try {
    const transaction = await initializePaystackTransaction(
      user.email,
      selectedPlan.priceKobo,
      reference,
    );

    payment.authorizationUrl = transaction.authorization_url;
    payment.accessCode = transaction.access_code;

    await payment.save();

    return {
      reference,
      authorizationUrl: transaction.authorization_url,
      accessCode: transaction.access_code,
      amountKobo: selectedPlan.priceKobo,
      plan,
    };
  } catch (error) {
    payment.status = "failed";
    await payment.save();

    if (error instanceof PaystackServiceError) {
      throw new PaymentServiceError(error.message, 502);
    }

    throw error;
  }
};

/**
 * Shared payment-processing function.
 *
 * Both the authenticated verification endpoint and the Paystack webhook
 * will use this function. It verifies the transaction with Paystack,
 * validates the amount and currency, and activates the subscription
 * inside a MongoDB transaction.
 */
export const processPaymentByReference = async (reference: string) => {
  const payment = await PaymentModel.findOne({ reference });

  if (!payment) {
    throw new PaymentServiceError("Payment record not found.", 404);
  }

  if (payment.status === "success") {
    const paidAt = payment.paidAt ?? payment.createdAt;
   const paidPlan = PLANS[payment.plan as PlanId];
    const currentPeriodEnd = addMonths(paidAt, paidPlan.months);

    return {
      alreadyProcessed: true,
      message: "Payment has already been verified.",
      reference: payment.reference,
      plan: payment.plan,
      currentPeriodEnd,
    };
  }

  if (payment.status === "failed") {
    throw new PaymentServiceError(
      "This payment has already been marked as failed.",
      400,
    );
  }

  let transaction;

  try {
    transaction = await verifyPaystackTransaction(reference);
  } catch (error) {
    if (error instanceof PaystackServiceError) {
      throw new PaymentServiceError(error.message, 502);
    }

    throw error;
  }

  if (transaction.reference !== payment.reference) {
    throw new PaymentServiceError("Transaction reference does not match.", 400);
  }

  if (
    transaction.amount !== payment.amountKobo ||
    transaction.currency !== "NGN"
  ) {
    throw new PaymentServiceError(
      "Transaction amount or currency does not match.",
      400,
    );
  }

  if (transaction.status !== "success") {
    if (transaction.status === "failed") {
      const failedPayment = await PaymentModel.findOneAndUpdate(
        {
          _id: payment._id,
          status: "pending",
        },
        {
          $set: { status: "failed" },
        },
        { new: true },
      );

      if (failedPayment) {
        void notifyPaymentFailure(failedPayment).catch((error: unknown) => {
          logger.error(
            { err: error, reference: failedPayment.reference },
            "Failed to send payment failure email.",
          );
        });
      }
    }

    throw new PaymentServiceError(
      "Payment has not been completed successfully.",
      400,
    );
  }

  const paidAt = transaction.paid_at
    ? new Date(transaction.paid_at)
    : new Date();

  if (Number.isNaN(paidAt.getTime())) {
    throw new PaymentServiceError(
      "Invalid payment date returned by Paystack.",
      400,
    );
  }

  const paidPlan = PLANS[payment.plan as PlanId];

  if (!paidPlan) {
    throw new PaymentServiceError(
      "Invalid subscription plan on payment record.",
      400,
    );
  }

  const currentPeriodEnd = addMonths(paidAt, paidPlan.months);

  const session = await mongoose.startSession();

  let paymentProcessed = false;
  let alreadyProcessed = false;

  try {
    await session.withTransaction(async () => {
      // Reset these values because MongoDB may retry a transaction.
      paymentProcessed = false;
      alreadyProcessed = false;

      // Atomically claim this payment. Only one request can change
      // its status from pending to success.
      const claimedPayment = await PaymentModel.findOneAndUpdate(
        {
          _id: payment._id,
          status: "pending",
        },
        {
          $set: {
            status: "success",
            paidAt,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!claimedPayment) {
        const existingPayment = await PaymentModel.findById(
          payment._id,
        ).session(session);

        if (existingPayment?.status === "success") {
          alreadyProcessed = true;
          return;
        }

        throw new PaymentServiceError(
          "Payment could not be processed because its status has changed.",
          409,
        );
      }

      const subscription = await SubscriptionModel.findOneAndUpdate(
        { businessId: payment.businessId },
        {
          $set: {
            plan: payment.plan,
            priceKobo: payment.amountKobo,
            currentPeriodEnd,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          session,
        },
      );

      if (!subscription) {
        throw new PaymentServiceError(
          "Could not activate the subscription.",
          500,
        );
      }

      const onboardingUpdate = await UserModel.updateOne(
        { _id: payment.userId },
        { $max: { onboardingStep: 4 } },
        { session },
      );

      if (onboardingUpdate.matchedCount === 0) {
        throw new PaymentServiceError(
          "Could not update the user's onboarding progress.",
          500,
        );
      }

      paymentProcessed = true;
    });
  } finally {
    await session.endSession();
  }

  // Send the receipt only when this request actually changed the
  // payment from pending to success.
  if (paymentProcessed) {
    void notifyPaymentSuccess(payment, paidAt, currentPeriodEnd).catch(
      (error: unknown) => {
        logger.error(
          { err: error, reference: payment.reference },
          "Failed to send payment success email.",
        );
      },
    );
  }

  return {
    alreadyProcessed,
    message: alreadyProcessed
      ? "Payment has already been verified."
      : "Payment verified and subscription activated successfully.",
    reference: payment.reference,
    plan: payment.plan,
    currentPeriodEnd,
  };
};

/**
 * Authenticated payment verification.
 *
 * Confirms that the payment belongs to the logged-in user before
 * passing it to the shared payment-processing function.
 */
export const verifySubscriptionPaymentService = async (
  userId: string,
  reference: string,
) => {
  const payment = await PaymentModel.findOne({
    userId,
    reference,
  });

  if (!payment) {
    throw new PaymentServiceError("Payment record not found.", 404);
  }

  return processPaymentByReference(reference);
};
