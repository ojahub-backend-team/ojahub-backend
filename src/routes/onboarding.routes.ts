import { Router } from "express";
import { verifySession } from "../middlewares/auth.middleware.js";
import { saveBusinessStep1Controller } from "../controllers/onboarding.controller.js";
import { requireBusiness } from "../middlewares/auth.middleware.js";

const router = Router();

router.put("/business", verifySession, saveBusinessStep1Controller);


export default router;
