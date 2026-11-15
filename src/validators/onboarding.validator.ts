import { z } from "zod";
import { LOCATION_TYPES } from "../models/location.model.js";

export const locationStep2Schema = z.object({
  name: z.string().trim().min(2, "Enter a name for this place").max(100),
  type: z.enum(LOCATION_TYPES),
  address: z.string().trim().min(2, "Enter an address or landmark").max(200),
});
