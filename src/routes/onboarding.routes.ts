import { Router } from "express";
import {
  requireBusiness,
  verifySession,
} from "../middlewares/auth.middleware.js";
import {
  saveBusinessStep1Controller,
  saveLocationStep2Controller,
  saveProductStep3Controller,
  skipProductStep3Controller,
} from "../controllers/onboarding.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { businessStep1Schema } from "../validators/auth.validator.js";
import {
  locationStep2Schema,
  productStep3Schema,
} from "../validators/onboarding.validator.js";

const router = Router();

router.put(
  "/business",
  verifySession,
  validate(businessStep1Schema),
  saveBusinessStep1Controller,
);

router.put(
  "/location",
  verifySession,
  requireBusiness,
  validate(locationStep2Schema),
  saveLocationStep2Controller,
);

router.put(
  "/product",
  verifySession,
  requireBusiness,
  validate(productStep3Schema),
  saveProductStep3Controller,
);

router.post(
  "/product/skip",
  verifySession,
  requireBusiness,
  skipProductStep3Controller,
);
export default router;
