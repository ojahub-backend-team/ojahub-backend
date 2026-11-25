import mongoose, { Document, Schema } from "mongoose";

export const MOVEMENT_TYPES = [
  "opening",
  "new_stock",
  "damaged",
  "count_correction",
  "transfer_out",
  "transfer_in",
  "sale",
] as const;

export interface IStockMovement extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  transferId?: mongoose.Types.ObjectId;
  type: (typeof MOVEMENT_TYPES)[number];
  quantityChange: number;
  balanceAfter: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema: Schema<IStockMovement> = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    transferId: { type: Schema.Types.ObjectId, ref: "StockTransfer" },
    type: { type: String, enum: [...MOVEMENT_TYPES], required: true },
    quantityChange: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Quantity change must be a whole number",
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Balance must be a whole number",
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

StockMovementSchema.index({ businessId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ businessId: 1, transferId: 1 });

StockMovementSchema.index(
  { businessId: 1, productId: 1, locationId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "opening" },
  },
);

const StockMovementModel =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);

export default StockMovementModel;
