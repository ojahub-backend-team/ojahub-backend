import { Router } from "express";
import {
  verifySession,
  requireBusiness,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  initializePaymentController,
  verifyPaymentController,
} from "../controllers/payment.controller.js";
import { initializePaymentSchema } from "../validators/payment.validators.js";
import { initializePaymentRateLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

router.use(verifySession, requireBusiness);

router.post(
  "/initialize",
  initializePaymentRateLimiter,
  validate(initializePaymentSchema),
  initializePaymentController,
);

router.post("/verify/:reference", verifyPaymentController);

export default router;
