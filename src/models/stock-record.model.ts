import mongoose, { Document, Schema } from "mongoose";

// Describes the availability state of a product at one location.
export type StockRecordStatus =
  | "out_of_stock"
  | "low_stock"
  | "getting_low"
  | "in_stock";

// Describes an independently managed stock record for the added inventory module.
export interface IStockRecord extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  quantity: number;
  lowStockThreshold: number;
  gettingLowThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

// Calculates the stock status using the configured quantity thresholds.
export const getStockRecordStatus = (
  quantity: number,
  lowStockThreshold = 15,
  gettingLowThreshold = 30,
): StockRecordStatus => {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= lowStockThreshold) return "low_stock";
  if (quantity < gettingLowThreshold) return "getting_low";
  return "in_stock";
};

// Defines the separate stock-record collection using ZIP 2 Location references.
const StockRecordSchema: Schema<IStockRecord> = new Schema(
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
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Low-stock threshold must be a whole number",
      },
    },
    gettingLowThreshold: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Getting-low threshold must be a whole number",
      },
    },
  },
  { timestamps: true, collection: "stock_records" },
);

// Ensures the getting-low threshold is higher than the low-stock threshold.
StockRecordSchema.pre("validate", function () {
  if (this.gettingLowThreshold <= this.lowStockThreshold) {
    this.invalidate(
      "gettingLowThreshold",
      "Getting-low threshold must be greater than low-stock threshold.",
    );
  }
});

// Allows one record for each product at each location in a business.
StockRecordSchema.index(
  { businessId: 1, productId: 1, locationId: 1 },
  { unique: true },
);
StockRecordSchema.index({ businessId: 1, locationId: 1 });
StockRecordSchema.index({ businessId: 1, productId: 1 });

// Registers a separate model so ZIP 2's StockLevel model remains untouched.
const StockRecordModel =
  mongoose.models.StockRecord ||
  mongoose.model<IStockRecord>("StockRecord", StockRecordSchema);

export default StockRecordModel;
