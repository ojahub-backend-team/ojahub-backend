import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");

const transferItemSchema = z.object({
  productId: objectIdSchema,
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),
});

export const createStockTransferSchema = z
  .object({
    sourceLocationId: objectIdSchema,
    destinationLocationId: objectIdSchema,
    items: z.array(transferItemSchema).min(1),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    ({ sourceLocationId, destinationLocationId }) =>
      sourceLocationId.toLowerCase() !== destinationLocationId.toLowerCase(),
    {
      path: ["destinationLocationId"],
      message: "Source and destination locations must be different",
    },
  )
  .refine(
    ({ items }) =>
      new Set(items.map(({ productId }) => productId.toLowerCase())).size ===
      items.length,
    {
      path: ["items"],
      message: "A product can only appear once in a transfer",
    },
  );

export type CreateStockTransferInput = z.infer<
  typeof createStockTransferSchema
>;
