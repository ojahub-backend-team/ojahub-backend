import { z } from "zod";
import { PLAN_IDS } from "../config/plans.js";

export const planStep4Schema = z.object({
  plan: z.enum(PLAN_IDS),
});
