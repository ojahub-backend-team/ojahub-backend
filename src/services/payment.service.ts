import { randomBytes } from "crypto";
import PaymentModel from "../models/payment.model.js";
import SubscriptionModel from "../models/subscription.model.js";
import UserModel from "../models/user.model.js";
import { PLANS, type PlanId } from "../config/plans.js";
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
 * Sends a payment failure email without interrupting payment processing.
 */
const notifyPaymentFailure = async (payment: {
  userId: unknown;
  plan: PlanId;
  amountKobo: number;
  reference: string;
}): Promise<void> => {
  try {
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
  } catch (error) {
    console.error("Failed to send payment failure email:", error);
  }
};

/**
 * Sends a payment success email without interrupting payment processing.
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
  try {
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
  } catch (error) {
    console.error("Failed to send payment success email:", error);
  }
};

/**
 * Initializes a subscription payment through Paystack.
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

  const subscription = await SubscriptionModel.findOne({
    businessId: user.businessId,
  });

  if (!subscription) {
    throw new PaymentServiceError(
      "No subscription found. Please select a subscription plan first.",
      404,
    );
  }

  const now = new Date();

  if (subscription.currentPeriodEnd && now < subscription.currentPeriodEnd) {
    throw new PaymentServiceError("Your subscription is already active.", 409);
  }

  if (now < subscription.trialEndsAt) {
    throw new PaymentServiceError(
      "Your free trial is still active. Payment is not required yet.",
      409,
    );
  }

  const selectedPlan = PLANS[plan];

  if (!selectedPlan) {
    throw new PaymentServiceError("Invalid subscription plan.");
  }

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "");

  const uniqueCode = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

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
 * Verifies a Paystack transaction and activates the subscription
 * only after successful verification.
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

  // Prevent repeated verification from sending duplicate emails.
  if (payment.status === "success") {
    const existingSubscription = await SubscriptionModel.findOne({
      businessId: payment.businessId,
    });

    const paidPlan = PLANS[payment.plan as PlanId];

    const currentPeriodEnd =
      existingSubscription?.currentPeriodEnd ??
      addMonths(payment.paidAt ?? payment.createdAt, paidPlan.months);

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
      payment.status = "failed";
      await payment.save();

      await notifyPaymentFailure(payment);
    }

    throw new PaymentServiceError(
      "Payment has not been completed successfully.",
      400,
    );
  }

  const subscription = await SubscriptionModel.findOne({
    businessId: payment.businessId,
  });

  if (!subscription) {
    throw new PaymentServiceError("Subscription record not found.", 404);
  }

  const paidAt = transaction.paid_at
    ? new Date(transaction.paid_at)
    : new Date();

  const paidPlan = PLANS[payment.plan as PlanId];

  const currentPeriodEnd = addMonths(paidAt, paidPlan.months);

  subscription.plan = payment.plan;
  subscription.priceKobo = payment.amountKobo;
  subscription.currentPeriodEnd = currentPeriodEnd;

  await subscription.save();

  payment.status = "success";
  payment.paidAt = paidAt;

  await payment.save();

  // Send the receipt only after successful verification and activation.
  await notifyPaymentSuccess(payment, paidAt, currentPeriodEnd);

  return {
    alreadyProcessed: false,
    message: "Payment verified and subscription activated successfully.",
    reference: payment.reference,
    plan: payment.plan,
    currentPeriodEnd,
  };
};
