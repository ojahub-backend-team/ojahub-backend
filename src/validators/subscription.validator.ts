import { z } from "zod";
import { SUBSCRIPTION_PLAN_IDS } from "../config/plans.js";

export const planStep4Schema = z.object({
  plan: z.enum(SUBSCRIPTION_PLAN_IDS),
});
