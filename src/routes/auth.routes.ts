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
  authRateLimiter,
  otpRateLimiter,
  passwordResetRateLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();
router.post(
  "/register",
  validate(registerSchema),
  authRateLimiter,
  registerUserController,
);
router.post(
  "/verify-email",
  otpRateLimiter,
  validate(verifyEmailSchema),
  verifyEmailController,
);
router.post(
  "/resend-otp",
  otpRateLimiter,
  validate(resendOtpSchema),
  resendOtpController,
);
router.post("/login", validate(loginSchema), authRateLimiter, loginController);
router.post("/logout", logoutController);
router.post("/logout-all", verifySession, logoutAllDevicesController);
router.post(
  "/google",
  validate(googleLoginSchema),
  authRateLimiter,
  googleLoginController,
);
router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController,
);
router.post(
  "/reset-password",
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  resetPasswordController,
);
export default router;
