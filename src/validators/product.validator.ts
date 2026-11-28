import { z } from "zod";
import { PRODUCT_CATEGORIES } from "../models/product.model.js";

// Validates a MongoDB price-profile ID.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid price profile ID");

// Validates one product price-profile tier.
const productPriceSchema = z
  .object({
    priceProfileId: objectIdSchema,
    minQuantity: z.number().int().min(1).optional(),
    maxQuantity: z.number().int().min(1).nullable().optional(),
    discountPercentage: z.number().min(0).max(100).default(0),
    priceKobo: z.number().int().min(0),
  })
  .refine(
    (price) =>
      price.minQuantity === undefined ||
      price.maxQuantity === undefined ||
      price.maxQuantity === null ||
      price.maxQuantity >= price.minQuantity,
    {
      message: "Maximum quantity cannot be less than minimum quantity",
      path: ["maxQuantity"],
    },
  );

// Validates all product price-profile tiers and prevents duplicate profile IDs.
const productPricesSchema = z
  .array(productPriceSchema)
  .min(1, "Add at least one product price")
  .superRefine((prices, ctx) => {
    const ids = prices.map((price) => price.priceProfileId);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "A product cannot have duplicate price profile entries",
      });
  });

// Validates the data required to create a product.
export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  category: z.enum(PRODUCT_CATEGORIES),
  sku: z.string().trim().max(50).optional(),
  unit: z.string().trim().min(1).max(50),
  prices: productPricesSchema,
});

// Validates partial product updates.
export const updateProductSchema = createProductSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// Validates product search and pagination parameters.
export const getProductsSchema = z.object({
  search: z.string().trim().optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
