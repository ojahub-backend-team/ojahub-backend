import mongoose, { Document, Schema } from "mongoose";

export const PRODUCT_UNITS = [
  "piece",
  "bundle",
  "carton",
  "pack",
  "yard",
  "bag",
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const PRODUCT_SOURCES = ["onboarding", "manual"] as const;

export interface IPriceTier {
  tierName: string;
  minimumQuantity: number;
  unitPrice: number; // kobo
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  name: string;
  unit: ProductUnit;
  priceTiers: IPriceTier[];
  isActive: boolean;
  source: (typeof PRODUCT_SOURCES)[number];
  createdAt: Date;
  updatedAt: Date;
}

const PriceTierSchema = new Schema<IPriceTier>(
  {
    tierName: { type: String, required: true, trim: true, lowercase: true },
    minimumQuantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Price must be in whole kobo",
      },
    },
  },
  { _id: false },
);

const ProductSchema: Schema<IProduct> = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    unit: { type: String, enum: [...PRODUCT_UNITS], required: true },
    priceTiers: { type: [PriceTierSchema], default: [] },
    isActive: { type: Boolean, default: true },
    source: { type: String, enum: [...PRODUCT_SOURCES], default: "manual" },
  },
  { timestamps: true },
);

ProductSchema.index({ businessId: 1, name: 1 });

ProductSchema.index(
  { businessId: 1, source: 1 },
  { unique: true, partialFilterExpression: { source: "onboarding" } },
);

const ProductModel =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default ProductModel;
