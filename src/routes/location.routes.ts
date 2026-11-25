import { Router } from "express";
import {
  verifySession,
  requireBusiness,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { locationStep2Schema } from "../validators/onboarding.validator.js";
import { createLocationController } from "../controllers/location.controller.js";

const router = Router();

// Ensure the user is logged in and has a business
router.use(verifySession, requireBusiness);

// Create an additional location
router.post("/", validate(locationStep2Schema), createLocationController);

export default router;
