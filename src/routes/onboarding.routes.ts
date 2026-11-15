import { Router } from "express";
import {
  requireBusiness,
  verifySession,
} from "../middlewares/auth.middleware.js";
import {
  saveBusinessStep1Controller,
  saveLocationStep2Controller,
} from "../controllers/onboarding.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { businessStep1Schema } from "../validators/auth.validator.js";
import { locationStep2Schema } from "../validators/onboarding.validator.js";

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

export default router;
