import mongoose, { Document, Schema } from "mongoose";
import {
  SUBSCRIPTION_PLAN_IDS,
  type SubscriptionPlanId,
} from "../config/plans.js";

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  plan: SubscriptionPlanId;
  priceKobo: number;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema<ISubscription> = new Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: SUBSCRIPTION_PLAN_IDS,
      required: true,
    },
    priceKobo: {
      type: Number,
      required: true,
      min: 0,
    },
    trialStartedAt: {
      type: Date,
    },
    trialEndsAt: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

const SubscriptionModel =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);

export default SubscriptionModel;
