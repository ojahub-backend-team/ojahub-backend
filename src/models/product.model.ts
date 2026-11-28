import mongoose, { Document, Schema } from "mongoose";

// Lists the product categories supported by OjaHub.
export const PRODUCT_CATEGORIES = [
  "Fabrics",
  "Electronics",
  "Phones",
  "Provision",
  "Cosmetics",
  "Building Materials",
  "Others",
] as const;

// Describes the product category union.
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Provides expanded preset units for ZIP 2's initial onboarding product form.
export const PRODUCT_UNITS = [
  "piece",
  "bundle",
  "carton",
  "pack",
  "yard",
  "bag",
  "metre",
  "roll",
  "kilogram",
  "gram",
  "tonne",
  "litre",
  "millilitre",
  "bottle",
  "can",
  "crate",
  "box",
  "dozen",
  "pair",
  "set",
  "sheet",
  "sachet",
  "tub",
  "gallon",
  "cubic_metre",
] as const;

// Describes the preset units accepted by the onboarding product form.
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

// Describes the legacy onboarding price tier retained for ZIP 2 compatibility.
export interface IPriceTier {
  tierName: string;
  minimumQuantity: number;
  unitPrice: number;
}

// Describes an individual price-profile quantity tier for a product.
export interface IProductPrice {
  priceProfileId: mongoose.Types.ObjectId;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercentage: number;
  priceKobo: number;
}

// Describes the Cloudinary image details stored on a product.
export interface IProductImage {
  url: string;
  publicId: string;
}

// Describes product fields used by onboarding and product management.
export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category?: ProductCategory;
  sku?: string;
  unit: string;
  prices: IProductPrice[];
  priceTiers: IPriceTier[];
  image: IProductImage | null;
  isActive: boolean;
  source: "onboarding" | "manual";
  createdAt: Date;
  updatedAt: Date;
}

// Defines the legacy onboarding pricing subdocument.
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

// Defines the price-profile pricing subdocument.
const ProductPriceSchema = new Schema<IProductPrice>(
  {
    priceProfileId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "PriceProfile",
    },
    minQuantity: { type: Number, required: true, min: 1 },
    maxQuantity: { type: Number, default: null, min: 1 },
    discountPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    priceKobo: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// Rejects a maximum quantity that is lower than its minimum quantity.
ProductPriceSchema.pre("validate", function () {
  if (
    this.maxQuantity !== null &&
    this.maxQuantity !== undefined &&
    this.maxQuantity < this.minQuantity
  ) {
    this.invalidate(
      "maxQuantity",
      "Maximum quantity cannot be less than minimum quantity.",
    );
  }
});

// Defines the Cloudinary image subdocument.
const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

// Defines the product schema while retaining ZIP 2 onboarding fields.
const ProductSchema: Schema<IProduct> = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: [...PRODUCT_CATEGORIES] },
    sku: { type: String, trim: true },
    unit: { type: String, required: true, trim: true },
    prices: { type: [ProductPriceSchema], default: [] },
    priceTiers: { type: [PriceTierSchema], default: [] },
    image: { type: ProductImageSchema, default: null },
    isActive: { type: Boolean, default: true },
    source: { type: String, enum: ["onboarding", "manual"], default: "manual" },
  },
  { timestamps: true },
);

// Supports business-scoped product name and SKU searches.
ProductSchema.index({ businessId: 1, name: 1 });
ProductSchema.index({ businessId: 1, sku: 1 });

// Ensures each business has at most one onboarding product.
ProductSchema.index(
  { businessId: 1, source: 1 },
  { unique: true, partialFilterExpression: { source: "onboarding" } },
);

// Reuses the registered model during development reloads.
const ProductModel =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default ProductModel;
