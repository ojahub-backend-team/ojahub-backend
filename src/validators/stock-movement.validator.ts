import { z } from "zod";

// Validates MongoDB ObjectId values used to filter stock movements.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID.");

// Validates filters, date ranges and pagination for stock movement history.
export const getStockMovementsSchema = z
  .object({
    productId: objectIdSchema.optional(),
    locationId: objectIdSchema.optional(),
    type: z
      .enum([
        "opening_stock",
        "stock_in",
        "stock_out",
        "purchase",
        "sale",
        "adjustment_in",
        "adjustment_out",
        "transfer_in",
        "transfer_out",
        "return_in",
        "return_out",
      ])
      .optional(),
    referenceType: z
      .enum(["transfer", "sale", "purchase", "adjustment", "manual", "other"])
      .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.startDate <= data.endDate,
    {
      message: "Start date cannot be later than end date.",
      path: ["startDate"],
    },
  );
