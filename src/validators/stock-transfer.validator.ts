import { z } from "zod";

// Validates MongoDB ObjectId values used in stock transfer requests.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID.");

// Validates a request to transfer stock between two different locations.
export const createStockTransferSchema = z
  .object({
    productId: objectIdSchema,
    fromLocationId: objectIdSchema,
    toLocationId: objectIdSchema,
    quantity: z.number().int().positive(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((data) => data.fromLocationId !== data.toLocationId, {
    message: "Source and destination locations must be different.",
    path: ["toLocationId"],
  });

// Validates filters and pagination when retrieving stock transfers.
export const getStockTransfersSchema = z.object({
  productId: objectIdSchema.optional(),
  locationId: objectIdSchema.optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
