import { z } from "zod";
import { LOCATION_TYPES } from "../models/location.model.js";
import { PRODUCT_UNITS } from "../models/product.model.js";

export const locationStep2Schema = z.object({
  name: z.string().trim().min(2, "Enter a name for this place").max(100),
  type: z.enum(LOCATION_TYPES),
  address: z.string().trim().min(2, "Enter an address or landmark").max(200),
});

export const productStep3Schema = z.object({
  name: z.string().trim().min(2, "Enter the product name").max(100),
  unit: z.enum(PRODUCT_UNITS),
  priceKobo: z
    .number()
    .int("Price must be a whole number of kobo")
    .min(100, "Price must be at least ₦1")
    .max(1_000_000_000_000, "Price is too high"),
  quantity: z
    .number()
    .int("Enter a whole number")
    .min(0, "Quantity cannot be negative")
    .max(10_000_000, "Quantity is too high"),
});
