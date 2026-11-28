import mongoose, { Document, Schema } from "mongoose";

// Lists the movement types supported by the separately added inventory module.
export type StockMovementType =
  | "opening_stock"
  | "stock_in"
  | "stock_out"
  | "purchase"
  | "sale"
  | "adjustment_in"
  | "adjustment_out"
  | "transfer_in"
  | "transfer_out"
  | "return_in"
  | "return_out";

// Lists the supported movement reference categories.
export type StockMovementReferenceType =
  | "transfer"
  | "sale"
  | "purchase"
  | "adjustment"
  | "manual"
  | "other";

// Describes an independent stock movement record for a business location.
export interface IStockMovementRecord extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  balanceAfter: number;
  referenceType: StockMovementReferenceType;
  referenceId?: mongoose.Types.ObjectId;
  reason?: string;
  note?: string;
  performedBy: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Defines the separate movement-history collection using ZIP 2 Location references.
const StockMovementRecordSchema: Schema<IStockMovementRecord> = new Schema(
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
    type: {
      type: String,
      required: true,
      enum: [
        "opening_stock",
        "stock_in",
        "stock_out",
        "purchase",
        "sale",
        "adjustment_in",
        "adjustment_out",
        "transfer_in",
        "transfer_out",
        "return_in",
        "return_out",
      ],
    },
    quantity: { type: Number, required: true, min: 0.000001 },
    quantityBefore: { type: Number, required: true, min: 0 },
    quantityAfter: { type: Number, required: true, min: 0 },
    quantityChange: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    referenceType: {
      type: String,
      required: true,
      enum: ["transfer", "sale", "purchase", "adjustment", "manual", "other"],
    },
    referenceId: { type: Schema.Types.ObjectId },
    reason: { type: String, trim: true },
    note: { type: String, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "stock_movement_records" },
);

// Supports movement history searches by business, location, product and date.
StockMovementRecordSchema.index({
  businessId: 1,
  locationId: 1,
  createdAt: -1,
});
StockMovementRecordSchema.index({ businessId: 1, productId: 1, createdAt: -1 });
StockMovementRecordSchema.index({ referenceType: 1, referenceId: 1 });

// Prevents duplicate sale deductions for the same product and location.
StockMovementRecordSchema.index(
  {
    businessId: 1,
    referenceType: 1,
    referenceId: 1,
    productId: 1,
    locationId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      referenceType: "sale",
      referenceId: { $exists: true },
    },
  },
);

// Registers a separate model so ZIP 2's onboarding StockMovement model remains untouched.
const StockMovementRecordModel =
  mongoose.models.StockMovementRecord ||
  mongoose.model<IStockMovementRecord>(
    "StockMovementRecord",
    StockMovementRecordSchema,
  );

export default StockMovementRecordModel;
