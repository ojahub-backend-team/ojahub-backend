import mongoose, { type Document, Schema } from "mongoose";

export const STOCK_TRANSFER_STATUSES = [
  "requested",
  "in_transit",
  "received",
] as const;

export interface IStockTransferItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IStockTransfer extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  sourceLocationId: mongoose.Types.ObjectId;
  destinationLocationId: mongoose.Types.ObjectId;
  items: IStockTransferItem[];
  status: (typeof STOCK_TRANSFER_STATUSES)[number];
  requestedBy: mongoose.Types.ObjectId;
  dispatchedBy?: mongoose.Types.ObjectId;
  receivedBy?: mongoose.Types.ObjectId;
  dispatchedAt?: Date;
  receivedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransferItemSchema = new mongoose.Schema<IStockTransferItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Transfer quantities must be whole numbers",
      },
    },
  },
  { _id: false },
);

const StockTransferSchema: Schema<IStockTransfer> = new mongoose.Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    sourceLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    destinationLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    items: {
      type: [TransferItemSchema],
      required: true,
      validate: {
        validator: (items: IStockTransferItem[]) => items.length > 0,
        message: "A transfer must contain at least one product",
      },
    },
    status: {
      type: String,
      enum: STOCK_TRANSFER_STATUSES,
      default: "requested",
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dispatchedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dispatchedAt: Date,
    receivedAt: Date,
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

// Prevent transfers between the same location
StockTransferSchema.pre("validate", function () {
  if (this.sourceLocationId?.equals(this.destinationLocationId)) {
    this.invalidate(
      "destinationLocationId",
      "Source and destination locations must be different.",
    );
  }
});

StockTransferSchema.index({ businessId: 1, status: 1, createdAt: -1 });

const StockTransferModel =
  mongoose.models.StockTransfer ||
  mongoose.model<IStockTransfer>("StockTransfer", StockTransferSchema);

export default StockTransferModel;
