import { Router } from "express";
import {
  registerUserController,
  verifyEmailController,
  resendOtpController,
  loginController,
  refreshTokenController,
  logoutController,
  logoutAllDevicesController,
  googleLoginController,
  forgotPasswordController,
  resetPasswordController,
} from "../controllers/authController.js";
import { verifySession } from "../middlewares/auth.middleware.js";
import {
  authRateLimiter,
  otpRateLimiter,
  passwordResetRateLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();
router.post("/register", authRateLimiter, registerUserController);
router.post("/verify-email", otpRateLimiter, verifyEmailController);
router.post("/resend-otp", otpRateLimiter, resendOtpController);
router.post("/login", authRateLimiter, loginController);
router.post("/refresh-token", authRateLimiter, refreshTokenController);
router.post("/logout", logoutController);
router.post("/logout-all", verifySession, logoutAllDevicesController);
router.post("/google", authRateLimiter, googleLoginController);
router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  forgotPasswordController,
);
router.post(
  "/reset-password",
  passwordResetRateLimiter,
  resetPasswordController,
);
export default router;
