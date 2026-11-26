import mongoose, { Document, Schema } from "mongoose";

export interface IStockLevel extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const StockLevelSchema: Schema<IStockLevel> = new Schema(
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
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
  },
  { timestamps: true },
);

StockLevelSchema.index({ productId: 1, locationId: 1 }, { unique: true });
StockLevelSchema.index({ businessId: 1, locationId: 1 });

const StockLevelModel =
  mongoose.models.StockLevel ||
  mongoose.model<IStockLevel>("StockLevel", StockLevelSchema);

export default StockLevelModel;
