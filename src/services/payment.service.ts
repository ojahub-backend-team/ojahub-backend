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

const isPlanId = (value: unknown): value is PlanId =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(PLANS, value);

const getPlanDetails = (value: unknown) => {
  if (!isPlanId(value)) {
    throw new PaymentServiceError("Invalid subscription plan.", 400);
  }

  return PLANS[value];
};

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
    planLabel: getPlanDetails(payment.plan).label,
    amountKobo: payment.amountKobo,
    reference: payment.reference,
  });
};

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
    planLabel: getPlanDetails(payment.plan).label,
    amountKobo: payment.amountKobo,
    reference: payment.reference,
    paidAt,
    currentPeriodEnd,
  });
};

const sendFailureNotification = (payment: {
  userId: unknown;
  plan: PlanId;
  amountKobo: number;
  reference: string;
}): void => {
  void notifyPaymentFailure(payment).catch((error: unknown) => {
    logger.error(
      { err: error, reference: payment.reference },
      "Failed to send payment failure email.",
    );
  });
};

/**
 * Initialize a paid subscription payment.
 *
 * Same plan:
 * Reuse the existing checkout where possible.
 *
 * Different plan:
 * Verify the previous checkout before releasing it.
 * A successful old payment is processed, not replaced.
 * An unverified checkout is never released.
 */
export const initializeSubscriptionPaymentService = async (
  userId: string,
  plan: PlanId,
) => {
  if (!isPlanId(plan)) {
    throw new PaymentServiceError("Invalid subscription plan.", 400);
  }

  const selectedPlan = getPlanDetails(plan);

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

  const now = new Date();

  const subscription = await SubscriptionModel.findOne({
    businessId: user.businessId,
  });

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
    let oldTransaction;

    try {
      oldTransaction = await verifyPaystackTransaction(
        pendingPayment.reference,
      );
    } catch (error) {
      logger.error(
        { err: error, reference: pendingPayment.reference },
        "Could not verify existing Paystack transaction.",
      );

      if (error instanceof PaystackServiceError) {
        throw new PaymentServiceError(
          "We could not verify your previous payment. Please try again shortly.",
          502,
        );
      }

      throw error;
    }

    if (
      oldTransaction.reference !== pendingPayment.reference ||
      oldTransaction.amount !== pendingPayment.amountKobo ||
      oldTransaction.currency !== "NGN"
    ) {
      throw new PaymentServiceError(
        "The previous transaction details could not be verified.",
        400,
      );
    }

    const oldStatus = String(oldTransaction.status).toLowerCase();

    // Never create a new checkout when the previous payment succeeded.
    if (oldStatus === "success") {
      await processPaymentByReference(pendingPayment.reference);

      throw new PaymentServiceError(
        "Your previous payment was successful. Your subscription has been processed.",
        409,
      );
    }

    // Reuse the existing checkout for the same plan.
    if (pendingPayment.plan === plan) {
      if (
        oldStatus !== "failed" &&
        oldStatus !== "abandoned" &&
        pendingPayment.authorizationUrl
      ) {
        return {
          reference: pendingPayment.reference,
          authorizationUrl: pendingPayment.authorizationUrl,
          accessCode: pendingPayment.accessCode,
          amountKobo: pendingPayment.amountKobo,
          plan: pendingPayment.plan,
          alreadyPending: true,
        };
      }

      if (oldStatus !== "failed" && oldStatus !== "abandoned") {
        throw new PaymentServiceError(
          "Your previous checkout is still being resolved. Please try again shortly.",
          409,
        );
      }
    }

    // Only release the previous checkout after Paystack verification.
    const nextStatus =
      oldStatus === "failed" || oldStatus === "abandoned"
        ? "failed"
        : "superseded";

    const releasedPayment = await PaymentModel.findOneAndUpdate(
      {
        _id: pendingPayment._id,
        status: "pending",
      },
      {
        $set: { status: nextStatus },
      },
      { new: true },
    );

    if (!releasedPayment) {
      throw new PaymentServiceError(
        "Your previous checkout changed while we were processing your request. Please try again.",
        409,
      );
    }

    if (nextStatus === "failed" && oldStatus === "failed") {
      sendFailureNotification(releasedPayment);
    }

    logger.info(
      {
        oldReference: releasedPayment.reference,
        oldPlan: releasedPayment.plan,
        newPlan: plan,
        businessId: user.businessId,
        oldStatus: nextStatus,
      },
      "Previous checkout released for a new plan.",
    );
  }

  // Generate a unique payment reference.
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

  let payment;

  try {
    payment = await PaymentModel.create({
      userId: user._id,
      businessId: user.businessId,
      plan,
      amountKobo: selectedPlan.priceKobo,
      reference,
      status: "pending",
      activationStatus: "not_activated",
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const existingPending = await PaymentModel.findOne({
        businessId: user.businessId,
        status: "pending",
      });

      if (
        existingPending &&
        existingPending.plan === plan &&
        existingPending.authorizationUrl
      ) {
        return {
          reference: existingPending.reference,
          authorizationUrl: existingPending.authorizationUrl,
          accessCode: existingPending.accessCode,
          amountKobo: existingPending.amountKobo,
          plan: existingPending.plan,
          alreadyPending: true,
        };
      }

      throw new PaymentServiceError(
        "Another checkout is already being created. Please try again shortly.",
        409,
      );
    }

    throw error;
  }

  try {
    const transaction = await initializePaystackTransaction(
      user.email,
      selectedPlan.priceKobo,
      reference,
    );

    payment.authorizationUrl = transaction.authorization_url;
    payment.accessCode = transaction.access_code;

    await payment.save();

    logger.info(
      { reference, userId, plan },
      "Paystack transaction initialized.",
    );

    return {
      reference,
      authorizationUrl: transaction.authorization_url,
      accessCode: transaction.access_code,
      amountKobo: selectedPlan.priceKobo,
      plan,
      alreadyPending: false,
    };
  } catch (error) {
    // A timeout does not prove Paystack failed to create the transaction.
    // Keep the payment pending until its status can be verified.
    logger.error(
      { err: error, reference },
      "Paystack initialization could not be confirmed.",
    );

    if (error instanceof PaystackServiceError) {
      throw new PaymentServiceError(
        "We could not confirm whether your checkout was created. Please try again shortly.",
        502,
      );
    }

    throw error;
  }
};

/**
 * Shared payment processing.
 * Used by the callback verification endpoint and Paystack webhook.
 */
export const processPaymentByReference = async (reference: string) => {
  const payment = await PaymentModel.findOne({ reference });

  if (!payment) {
    throw new PaymentServiceError("Payment record not found.", 404);
  }

  const paidPlan = getPlanDetails(payment.plan);

  if (payment.status === "success") {
    const paidAt = payment.paidAt ?? payment.createdAt;

    return {
      alreadyProcessed: true,
      activationStatus: payment.activationStatus,
      message:
        payment.activationStatus === "needs_review"
          ? "Payment was successful but requires subscription reconciliation."
          : "Payment has already been verified.",
      reference: payment.reference,
      plan: payment.plan,
      currentPeriodEnd: addMonths(paidAt, paidPlan.months),
    };
  }

  let transaction;

  try {
    transaction = await verifyPaystackTransaction(reference);
  } catch (error) {
    logger.error(
      { err: error, reference },
      "Paystack transaction verification failed.",
    );

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

  const transactionStatus = String(transaction.status).toLowerCase();

  if (transactionStatus !== "success") {
    if (transactionStatus === "failed" || transactionStatus === "abandoned") {
      const failedPayment = await PaymentModel.findOneAndUpdate(
        {
          _id: payment._id,
          status: { $in: ["pending", "superseded"] },
        },
        {
          $set: { status: "failed" },
        },
        { new: true },
      );

      if (failedPayment && transactionStatus === "failed") {
        sendFailureNotification(failedPayment);
      }

      throw new PaymentServiceError(
        "Paystack confirmed that this payment was not successful. You can select a plan and try again.",
        400,
      );
    }

    throw new PaymentServiceError(
      "Your payment is still being processed. Please check again shortly.",
      409,
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

  const currentPeriodEnd = addMonths(paidAt, paidPlan.months);
  const session = await mongoose.startSession();

  let paymentProcessed = false;
  let alreadyProcessed = false;
  let needsReview = false;

  try {
    await session.withTransaction(async () => {
      paymentProcessed = false;
      alreadyProcessed = false;
      needsReview = false;

      const currentPayment = await PaymentModel.findById(payment._id).session(
        session,
      );

      if (!currentPayment) {
        throw new PaymentServiceError("Payment record not found.", 404);
      }

      if (currentPayment.status === "success") {
        alreadyProcessed = true;
        return;
      }

      const wasSuperseded =
        currentPayment.status === "superseded" ||
        currentPayment.status === "failed";

      if (
        !["pending", "superseded", "failed"].includes(
          String(currentPayment.status),
        )
      ) {
        throw new PaymentServiceError(
          "Payment cannot be processed in its current state.",
          409,
        );
      }

      // Record Paystack's actual success.
      const claimedPayment = await PaymentModel.findOneAndUpdate(
        {
          _id: payment._id,
          status: { $in: ["pending", "superseded", "failed"] },
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
        const latestPayment = await PaymentModel.findById(payment._id).session(
          session,
        );

        if (latestPayment?.status === "success") {
          alreadyProcessed = true;
          return;
        }

        throw new PaymentServiceError(
          "Payment status changed while processing. Please verify again.",
          409,
        );
      }

      // A superseded or previously failed checkout must not
      // automatically activate its old plan.
      if (wasSuperseded) {
        await PaymentModel.updateOne(
          { _id: payment._id },
          {
            $set: { activationStatus: "needs_review" },
          },
          { session },
        );

        needsReview = true;

        logger.error(
          {
            reference: payment.reference,
            businessId: payment.businessId,
            plan: payment.plan,
          },
          "A superseded or failed Paystack payment succeeded. Reconciliation is required.",
        );

        return;
      }

      const existingSubscription = await SubscriptionModel.findOne({
        businessId: payment.businessId,
      }).session(session);

      const activeSubscription =
        existingSubscription?.currentPeriodEnd &&
        existingSubscription.currentPeriodEnd > new Date();

      // Never overwrite an active paid subscription.
      if (activeSubscription) {
        await PaymentModel.updateOne(
          { _id: payment._id },
          {
            $set: { activationStatus: "needs_review" },
          },
          { session },
        );

        needsReview = true;

        logger.error(
          {
            reference: payment.reference,
            businessId: payment.businessId,
            plan: payment.plan,
          },
          "Payment succeeded while another subscription was active. Reconciliation is required.",
        );

        return;
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

      await PaymentModel.updateOne(
        { _id: payment._id },
        {
          $set: { activationStatus: "activated" },
        },
        { session },
      );

      paymentProcessed = true;
    });
  } finally {
    await session.endSession();
  }

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
    activationStatus: needsReview
      ? "needs_review"
      : alreadyProcessed
        ? payment.activationStatus
        : "activated",
    message: needsReview
      ? "Payment succeeded, but subscription reconciliation is required."
      : alreadyProcessed
        ? "Payment has already been verified."
        : "Payment verified and subscription activated successfully.",
    reference: payment.reference,
    plan: payment.plan,
    currentPeriodEnd,
  };
};

/**
 * Authenticated payment verification.
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
