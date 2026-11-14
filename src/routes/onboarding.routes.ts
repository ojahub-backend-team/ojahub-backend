import { Router } from "express";
import { verifySession } from "../middlewares/auth.middleware.js";
import { saveBusinessStep1Controller } from "../controllers/onboarding.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { businessStep1Schema } from "../validators/auth.validator.js";


const router = Router();

router.put(
  "/business",
  verifySession,
  validate(businessStep1Schema),
  saveBusinessStep1Controller,
);


export default router;
