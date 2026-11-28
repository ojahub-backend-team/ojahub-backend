import mongoose, { Document, Schema } from "mongoose";

// Describes the possible states of a stock transfer.
export type StockTransferStatus = "pending" | "completed" | "cancelled";

// Describes stock transferred between two business locations.
export interface IStockTransfer extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  fromLocationId: mongoose.Types.ObjectId;
  toLocationId: mongoose.Types.ObjectId;
  quantity: number;
  status: StockTransferStatus;
  reference?: string;
  note?: string;
  initiatedBy: mongoose.Types.ObjectId;
  completedBy?: mongoose.Types.ObjectId;
  transferredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Defines a stock transfer between two different locations.
const StockTransferSchema: Schema<IStockTransfer> = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    fromLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    toLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Transfer quantity must be a whole number",
      },
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    transferredAt: { type: Date },
  },
  { timestamps: true },
);

// Rejects transfers between the same location.
StockTransferSchema.pre("validate", function () {
  if (
    this.fromLocationId &&
    this.toLocationId &&
    this.fromLocationId.equals(this.toLocationId)
  )
    this.invalidate(
      "toLocationId",
      "Source and destination locations must be different.",
    );
});

// Supports transfer history by business, date, status and product.
StockTransferSchema.index({ businessId: 1, createdAt: -1 });
StockTransferSchema.index({ businessId: 1, status: 1 });
StockTransferSchema.index({ businessId: 1, productId: 1 });

// Reuses the registered model during development reloads.
const StockTransferModel =
  mongoose.models.StockTransfer ||
  mongoose.model<IStockTransfer>("StockTransfer", StockTransferSchema);

export default StockTransferModel;
