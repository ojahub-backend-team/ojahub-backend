import { z } from "zod";

// Validates the fields required to create a business location used as a store.
export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(["shop", "warehouse"]),
  address: z.string().trim().min(2).max(300),
  isDefault: z.boolean().optional(),
});

// Validates partial updates to an existing store location.
export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    type: z.enum(["shop", "warehouse"]).optional(),
    address: z.string().trim().min(2).max(300).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// Validates store search, active status and pagination query parameters.
export const getStoresSchema = z.object({
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
