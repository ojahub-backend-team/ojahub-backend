import { z } from "zod";

// Validates a request to add stock to a product at a particular store.
export const addStockSchema = z
  .object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID."),
    locationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid location ID."),
    quantity: z.number().int().positive(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// Validates a manual increase or decrease of a product's stock quantity.
export const adjustStockSchema = z
  .object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID."),
    locationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid location ID."),
    adjustmentType: z.enum(["increase", "decrease"]),
    quantity: z.number().int().positive(),
    reason: z.string().trim().min(2).max(200),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// Validates changes to the low-stock and getting-low thresholds.
export const updateStockThresholdSchema = z
  .object({
    lowStockThreshold: z.number().int().min(1).optional(),
    gettingLowThreshold: z.number().int().min(2).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one threshold to update.",
  })
  .refine(
    (data) =>
      data.lowStockThreshold === undefined ||
      data.gettingLowThreshold === undefined ||
      data.gettingLowThreshold > data.lowStockThreshold,
    {
      message:
        "Getting-low threshold must be greater than low-stock threshold.",
    },
  );

// Validates filters and pagination when retrieving stock records.
export const getStockSchema = z.object({
  productId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  locationId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  status: z
    .enum(["out_of_stock", "low_stock", "getting_low", "in_stock"])
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
