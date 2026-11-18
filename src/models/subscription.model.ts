import mongoose, { Document, Schema } from "mongoose";
import { PLAN_IDS, type PlanId } from "../config/plans.js";

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  plan: PlanId;
  priceKobo: number; // price when the plan was chosen
  trialStartedAt: Date;
  trialEndsAt: Date;
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
      unique: true, // one subscription per business
    },
    plan: {
      type: String,
      enum: PLAN_IDS,
      required: true,
    },
    priceKobo: {
      type: Number,
      required: true,
      min: 0,
    },
    trialStartedAt: {
      type: Date,
      required: true,
    },
    trialEndsAt: {
      type: Date,
      required: true,
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
