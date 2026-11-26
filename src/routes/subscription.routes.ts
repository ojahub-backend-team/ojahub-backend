import { Router } from "express";
import {
  requireBusiness,
  verifySession,
} from "../middlewares/auth.middleware.js";
import {
  getSubscriptionController,
  getPlansController,
} from "../controllers/subscription.controller.js";

const router = Router();

router.get("/plans", verifySession, getPlansController);
router.get("/", verifySession, requireBusiness, getSubscriptionController);

export default router;
