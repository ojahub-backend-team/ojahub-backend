import { Router } from "express";
import {
  registerUserController,
  verifyEmailController,
  resendOtpController,
  loginController,
  logoutController,
  logoutAllDevicesController,
  googleLoginController,
  forgotPasswordController,
  resetPasswordController,
  meController,
} from "../controllers/authController.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  registerSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import { verifySession } from "../middlewares/auth.middleware.js";
import {
  registerRateLimiter,
  loginRateLimiter,
  googleRateLimiter,
  verifyEmailRateLimiter,
  resendOtpRateLimiter,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  registerRateLimiter,
  registerUserController,
);

router.post(
  "/verify-email",
  verifyEmailRateLimiter,
  validate(verifyEmailSchema),
  verifyEmailController,
);

router.post(
  "/resend-otp",
  resendOtpRateLimiter,
  validate(resendOtpSchema),
  resendOtpController,
);

router.post("/login", validate(loginSchema), loginRateLimiter, loginController);
router.post("/logout", logoutController);
router.post("/logout-all", verifySession, logoutAllDevicesController);

router.post(
  "/google",
  validate(googleLoginSchema),
  googleRateLimiter,
  googleLoginController,
);

router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController,
);

router.post(
  "/reset-password",
  resetPasswordRateLimiter,
  validate(resetPasswordSchema),
  resetPasswordController,
);

router.get("/me", verifySession, meController);

export default router;
