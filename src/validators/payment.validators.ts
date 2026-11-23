import { z } from "zod";
import { PLAN_IDS } from "../config/plans.js";

export const initializePaymentSchema = z.object({
  plan: z.enum(PLAN_IDS),
});
