import {
  registerUserService,
  verifyEmailService,
  resendOtpService,
  loginUserService,
  refreshTokenService,
  logoutService,
  logoutAllDevicesService,
  googleLoginService,
  forgotPasswordService,
  resetPasswordService,
} from "../services/auth.service.js";
import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import { startSession } from "../utils/startSession.js";
import { endSession } from "../utils/sessionCleanup.js";

export const registerUserController = tryCatchFn(async (req, res) => {
  const result = await registerUserService(req.body);
  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 201, {
    success: true,
    message: "User registered successfully",
    body: {
      user: result.user,
    },
  });
});

export const verifyEmailController = tryCatchFn(async (req, res) => {
  const result = await verifyEmailService(req.body);
  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }
  await startSession(req, result.user);
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: { user: result.user },
  });
});
export const resendOtpController = tryCatchFn(async (req, res) => {
  let result = await resendOtpService(req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse<undefined>(res, 200, {
    success: true,
    message: result.message,
  });
});
export const forgotPasswordController = tryCatchFn(async (req, res) => {
  let { email } = req.body;

  if (!email) {
    return sendErrorResponse(res, 400, "Email is required");
  }

  let result = await forgotPasswordService({ email });

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  sendSuccessResponse<undefined>(res, 200, {
    success: true,
    message: result.message,
  });
});
export const resetPasswordController = tryCatchFn(async (req, res) => {
  let { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return sendErrorResponse(
      res,
      400,
      "Email, verification code, and new password are required",
    );
  }

  let result = await resetPasswordService({
    email,
    otp,
    newPassword,
  });

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  sendSuccessResponse<undefined>(res, 200, {
    success: true,
    message: result.message,
  });
});
export const loginController = tryCatchFn(async (req, res) => {
  let result = await loginUserService(req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  await startSession(req, result.user, req.body.rememberMe === true);

  sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});
export const refreshTokenController = tryCatchFn(async (req, res) => {
  let result = await refreshTokenService(req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});
export const logoutController = tryCatchFn(async (req, res) => {
  await endSession(req, res);

  return sendSuccessResponse<undefined>(res, 200, {
    success: true,
    message: "Logged out successfully",
  });
});

export const logoutAllDevicesController = tryCatchFn(async (req, res) => {
  if (!req.user) {
    return sendErrorResponse(res, 401, "Authentication required");
  }

  let result = await logoutAllDevicesService(req.user._id);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  await endSession(req, res);

  sendSuccessResponse<undefined>(res, 200, {
    success: true,
    message: result.message,
  });
});

export const googleLoginController = tryCatchFn(async (req, res) => {
  let { idToken } = req.body;

  if (!idToken) {
    return sendErrorResponse(res, 400, "Google ID token is required");
  }

  let result = await googleLoginService({ idToken });

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  await startSession(req, result.user);
  sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});
