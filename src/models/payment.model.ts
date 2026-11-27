import mongoose, { Document, Schema } from "mongoose";
import { PLAN_IDS, type PlanId } from "../config/plans.js";

export const PAYMENT_STATUSES = [
  "pending",
  "success",
  "failed",
  "superseded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_ACTIVATION_STATUSES = [
  "not_activated",
  "activated",
  "needs_review",
] as const;

export type PaymentActivationStatus =
  (typeof PAYMENT_ACTIVATION_STATUSES)[number];

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  plan: PlanId;
  amountKobo: number;
  reference: string;
  status: PaymentStatus;
  activationStatus: PaymentActivationStatus;
  authorizationUrl?: string;
  accessCode?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema<IPayment> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    plan: {
      type: String,
      enum: PLAN_IDS,
      required: true,
    },
    amountKobo: {
      type: Number,
      required: true,
      min: 1,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      required: true,
    },
    activationStatus: {
      type: String,
      enum: PAYMENT_ACTIVATION_STATUSES,
      default: "not_activated",
      required: true,
    },
    authorizationUrl: {
      type: String,
    },
    accessCode: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Only one active checkout per business.
// Superseded, failed and successful payments do not occupy this slot.
PaymentSchema.index(
  { businessId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "one_pending_payment_per_business",
  },
);

const PaymentModel =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default PaymentModel;
