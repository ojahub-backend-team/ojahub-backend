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

const router = Router();

router.use(verifySession, requireBusiness);

router.post(
  "/initialize",
  validate(initializePaymentSchema),
  initializePaymentController,
);

router.get("/verify/:reference", verifyPaymentController);

export default router;
