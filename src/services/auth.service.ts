import bcrypt from "bcrypt";
import userModel from "../models/user.model.js";
import BusinessModel from "../models/business.model.js";
import { prepareOtp } from "../utils/otp.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/email.js";
import { validatePassword } from "../utils/password.js";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/keys.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from "../utils/token.js";
import RefreshTokenModel from "../models/refreshToken.model.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

type formDataType = {
  email: string;
  password: string;
  name: string;
  phone: string;
};

type userProfile = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "user" | "admin";
  businessId: string;
  emailVerified: boolean;
};

type ServiceError = { success: false; status: number; message: string };

type RegisterUserResult =
  | { success: true; user: userProfile; message: string }
  | ServiceError;

type VerifyEmailResult = { success: true; message: string } | ServiceError;

type ResendOtpResult = { success: true; message: string } | ServiceError;

type LoginResult =
  | {
      success: true;
      user: userProfile;
      accessToken: string;
      refreshToken: string;
      message: string;
    }
  | ServiceError;

type RefreshTokenFormData = {
  refreshToken: string;
};

type RefreshTokenResult =
  | {
      success: true;
      accessToken: string;
      refreshToken: string;
      message: string;
    }
  | ServiceError;

type LogoutFormData = {
  refreshToken: string;
};

type LogoutResult =
  | {
      success: true;
      message: string;
    }
  | ServiceError;

type VerifyEmailFormData = {
  email: string;
  otp: string;
};
type LoginFormData = {
  emailOrPhone: string;
  password: string;
  rememberMe?: boolean;
};
type ForgotPasswordFormData = {
  email: string;
};

type ForgotPasswordResult =
  | {
      success: true;
      message: string;
    }
  | ServiceError;

type ResetPasswordFormData = {
  email: string;
  otp: string;
  newPassword: string;
};

type ResetPasswordResult =
  | {
      success: true;
      message: string;
    }
  | ServiceError;
type GoogleLoginFormData = {
  idToken: string;
};
type ResendOtpFormData = {
  email: string;
};

export const verifyEmailService = async (
  formData: VerifyEmailFormData,
): Promise<VerifyEmailResult> => {
  const { email, otp } = formData;

  const normalizedEmail = email.trim().toLowerCase();
  const submittedOtp = otp.trim();
  const user = await userModel.findOne({ email: normalizedEmail });
  if (!user) {
    return {
      success: false,
      status: 404,
      message: "User not found",
    };
  }
  if (user.emailVerified) {
    return {
      success: false,
      status: 400,
      message: "Email is already verified",
    };
  }
  if (!user.otp) {
    return {
      success: false,
      status: 400,
      message: "No verification code found. Please request a new one.",
    };
  }
  if (user.otp.expiresAt.getTime() <= Date.now()) {
    return {
      success: false,
      status: 400,
      message: "Verification code has expired. Please request a new one.",
    };
  }
  if (user.otp.attempts >= 5) {
    return {
      success: false,
      status: 429,
      message:
        "Too many incorrect attempts. Please request a new verification code.",
    };
  }
  let isOtpCorrect = await bcrypt.compare(submittedOtp, user.otp.code);
  if (!isOtpCorrect) {
    user.otp.attempts += 1;

    await user.save();

    return {
      success: false,
      status: 400,
      message: "Incorrect verification code",
    };
  }
  user.emailVerified = true;
  user.otp = undefined;
  await user.save();
  return {
    success: true,
    message: "Email verified successfully",
  };
};

export const registerUserService = async (
  formData: formDataType,
): Promise<RegisterUserResult> => {
  const { email, password, name, phone } = formData;
  let passwordError = validatePassword(password);

  if (passwordError) {
    return {
      success: false,
      status: 400,
      message: passwordError,
    };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const existingUser = await userModel.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
  });

  if (existingUser) {
    return {
      success: false,
      status: 409,
      message: "Email or phone number already exists",
    };
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const { otp, otpData } = await prepareOtp();
  const newBusiness = await BusinessModel.create({
    name: `${name.trim()}'s Business`,
  });
  const newUser = await userModel.create({
    email: normalizedEmail,
    name: name.trim(),
    phone: normalizedPhone,
    password: hashedPassword,
    businessId: newBusiness._id,
    otp: otpData,
  });
  await sendVerificationEmail(normalizedEmail, otp);
  return {
    success: true,
    user: {
      _id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      businessId: newUser.businessId.toString(),
      emailVerified: newUser.emailVerified,
    },
    message: "Registration successful. Please verify your email.",
  };
};
export const resendOtpService = async (
  formData: ResendOtpFormData,
): Promise<ResendOtpResult> => {
  let normalizedEmail = formData.email.trim().toLowerCase();

  let user = await userModel.findOne({ email: normalizedEmail });

  if (!user) {
    return {
      success: false,
      status: 404,
      message: "User not found",
    };
  }

  if (user.emailVerified) {
    return {
      success: false,
      status: 400,
      message: "Email is already verified",
    };
  }

  if (!user.otp) {
    return {
      success: false,
      status: 400,
      message: "No verification code found",
    };
  }

  let now = Date.now();
  let lastSentAt = user.otp.lastSentAt.getTime();

  // Enforce the 60-second cooldown.
  if (now - lastSentAt < 60 * 1000) {
    return {
      success: false,
      status: 429,
      message: "Please wait 60 seconds before requesting another code",
    };
  }

  let oneHour = 60 * 60 * 1000;
  let windowStartedAt = user.otp.resendWindowStartedAt.getTime();

  // Reset the resend counter after one hour.
  if (now - windowStartedAt >= oneHour) {
    user.otp.resendCount = 0;
    user.otp.resendWindowStartedAt = new Date(now);
  }

  if (user.otp.resendCount >= 5) {
    return {
      success: false,
      status: 429,
      message: "You have reached the maximum of 5 resend requests per hour",
    };
  }

  let { otp, otpData } = await prepareOtp();

  user.otp = {
    ...otpData,
    resendCount: user.otp.resendCount + 1,
    resendWindowStartedAt: user.otp.resendWindowStartedAt,
  };

  await user.save();

  await sendVerificationEmail(normalizedEmail, otp);

  return {
    success: true,
    message: "A new verification code has been sent to your email",
  };
};
export const forgotPasswordService = async (
  formData: ForgotPasswordFormData,
): Promise<ForgotPasswordResult> => {
  let normalizedEmail = formData.email.trim().toLowerCase();

  let user = await userModel
    .findOne({ email: normalizedEmail })
    .select("+password");

  if (!user || !user.emailVerified || !user.passwordResetOtp) {
    if (
      user.passwordResetOtp?.lastSentAt &&
      Date.now() - user.passwordResetOtp.lastSentAt.getTime() < 60 * 1000
    ) {
      return {
        success: true,
        message:
          "If an eligible account exists, a password reset code has been sent.",
      };
    }
    if (
      user.passwordResetOtp?.resendWindowStartedAt &&
      Date.now() - user.passwordResetOtp.resendWindowStartedAt.getTime() <
        60 * 60 * 1000 &&
      user.passwordResetOtp.resendCount >= 5
    ) {
      return {
        success: true,
        message:
          "If an eligible account exists, a password reset code has been sent.",
      };
    }
    let { otp, otpData } = await prepareOtp();

    let now = new Date();

    let resendWindowStartedAt = user.passwordResetOtp?.resendWindowStartedAt;

    let isWithinResendWindow = Boolean(
      resendWindowStartedAt &&
      now.getTime() - resendWindowStartedAt.getTime() < 60 * 60 * 1000,
    );

    user.passwordResetOtp = {
      code: otpData.code,
      expiresAt: otpData.expiresAt,
      attempts: 0,
      lastSentAt: now,
      resendCount: isWithinResendWindow
        ? (user.passwordResetOtp?.resendCount ?? 0) + 1
        : 1,
      resendWindowStartedAt: isWithinResendWindow
        ? resendWindowStartedAt!
        : now,
    };

    await user.save();

    await sendPasswordResetEmail(normalizedEmail, otp);
  }

  return {
    success: true,
    message:
      "If an eligible account exists, a password reset code has been sent.",
  };
};
export const resetPasswordService = async (
  formData: ResetPasswordFormData,
): Promise<ResetPasswordResult> => {
  let { email, otp, newPassword } = formData;

  let normalizedEmail = email.trim().toLowerCase();

  let passwordError = validatePassword(newPassword);

  if (passwordError) {
    return {
      success: false,
      status: 400,
      message: passwordError,
    };
  }

  let user = await userModel.findOne({ email: normalizedEmail });

  if (!user || !user.passwordResetOtp) {
    return {
      success: false,
      status: 400,
      message: "Invalid or expired password reset code",
    };
  }

  if (user.passwordResetOtp.expiresAt.getTime() <= Date.now()) {
    user.passwordResetOtp = undefined;
    await user.save();

    return {
      success: false,
      status: 400,
      message: "Password reset code has expired",
    };
  }

  if (user.passwordResetOtp.attempts >= 5) {
    return {
      success: false,
      status: 429,
      message: "Too many incorrect attempts. Request a new code.",
    };
  }

  let isOtpCorrect = await bcrypt.compare(
    otp.trim(),
    user.passwordResetOtp.code,
  );

  if (!isOtpCorrect) {
    user.passwordResetOtp.attempts += 1;
    await user.save();

    return {
      success: false,
      status: 400,
      message: "Incorrect password reset code",
    };
  }
  if (user.password) {
    let isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return {
        success: false,
        status: 400,
        message:
          "Your new password must be different from your current password.",
      };
    }
  }

  let salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.passwordResetOtp = undefined;

  await user.save();

  await RefreshTokenModel.deleteMany({ user: user._id });

  return {
    success: true,
    message: "Password reset successfully. Please log in again.",
  };
};
export const loginUserService = async (
  formData: LoginFormData,
): Promise<LoginResult> => {
  let { emailOrPhone, password, rememberMe = false } = formData;

  let identifier = emailOrPhone.trim();

  let user = await userModel
    .findOne(
      identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { phone: identifier },
    )
    .select("+password");
  if (!user || !user.password) {
    return {
      success: false,
      status: 401,
      message: "Invalid email/phone or password",
    };
  }
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    return {
      success: false,
      status: 423,
      message: "Account temporarily locked. Please try again later.",
    };
  }
  if (user.lockUntil && user.lockUntil.getTime() <= Date.now()) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();
  }
  let isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
    }

    await user.save();

    return {
      success: false,
      status: 401,
      message: "Invalid email/phone or password",
    };
  }
  if (!user.emailVerified) {
    return {
      success: false,
      status: 403,
      message: "Please verify your email before logging in",
    };
  }
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;

  await user.save();
  let accessToken = generateAccessToken(user._id.toString());

  let refreshToken = generateRefreshToken(user._id.toString(), rememberMe);
  let tokenHash = hashRefreshToken(refreshToken);
  let sessionDurationDays: 7 | 30 = rememberMe ? 30 : 7;

  let expiresAt = new Date(
    Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000,
  );

  await RefreshTokenModel.create({
    user: user._id,
    tokenHash,
    expiresAt,
    sessionDurationDays,
  });
  return {
    success: true,
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      businessId: user.businessId.toString(),
      emailVerified: user.emailVerified,
    },
    accessToken,
    refreshToken,
    message: "Login successful",
  };
};
export const googleLoginService = async (
  formData: GoogleLoginFormData,
): Promise<LoginResult> => {
  let { idToken } = formData;

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch {
    return {
      success: false,
      status: 401,
      message: "Invalid Google ID token",
    };
  }

  let payload = ticket.getPayload();

  if (
    !payload ||
    !payload.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    return {
      success: false,
      status: 401,
      message: "Google account email is not verified",
    };
  }
  let user = await userModel.findOne({
    $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }],
  });
  if (user) {
    if (user.googleId && user.googleId !== payload.sub) {
      return {
        success: false,
        status: 409,
        message: "This email is already linked to another Google account",
      };
    }

    user.googleId = payload.sub;
    user.emailVerified = true;

    await user.save();
  }
  if (!user) {
    let business = await BusinessModel.create({
      name: `${payload.name || "My"}'s Business`,
    });

    user = await userModel.create({
      name: payload.name || "Google User",
      email: payload.email.toLowerCase(),
      googleId: payload.sub,
      role: "user",
      businessId: business._id,
      emailVerified: true,
    });
  }

  let accessToken = generateAccessToken(user._id.toString());

  let refreshToken = generateRefreshToken(user._id.toString(), false);

  let tokenHash = hashRefreshToken(refreshToken);

  let sessionDurationDays: 7 | 30 = 7;

  let expiresAt = new Date(
    Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000,
  );

  await RefreshTokenModel.create({
    user: user._id,
    tokenHash,
    expiresAt,
    sessionDurationDays,
  });
  return {
    success: true,
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      businessId: user.businessId.toString(),
      emailVerified: user.emailVerified,
    },
    accessToken,
    refreshToken,
    message: "Google login successful",
  };
};
export const refreshTokenService = async (
  formData: RefreshTokenFormData,
): Promise<RefreshTokenResult> => {
  let { refreshToken } = formData;

  let decoded = verifyRefreshToken(refreshToken);

  if (!decoded) {
    return {
      success: false,
      status: 401,
      message: "Invalid or expired refresh token",
    };
  }
  let tokenHash = hashRefreshToken(refreshToken);
  let storedToken = await RefreshTokenModel.findOne({
    user: decoded.userId,
    tokenHash,
  });
  if (!storedToken) {
    return {
      success: false,
      status: 401,
      message: "Refresh token session is invalid or expired",
    };
  }

  if (storedToken.expiresAt.getTime() <= Date.now()) {
    await RefreshTokenModel.deleteOne({ _id: storedToken._id });

    return {
      success: false,
      status: 401,
      message: "Refresh token session is invalid or expired",
    };
  }
  let user = await userModel.findById(decoded.userId);

  if (!user || !user.emailVerified) {
    await RefreshTokenModel.deleteOne({ _id: storedToken._id });

    return {
      success: false,
      status: 401,
      message: "User account is unavailable or not verified",
    };
  }
  let accessToken = generateAccessToken(user._id.toString());

  let newRefreshToken = generateRefreshToken(
    user._id.toString(),
    storedToken.sessionDurationDays === 30,
  );
  let newTokenHash = hashRefreshToken(newRefreshToken);
  let sessionDurationDays = storedToken.sessionDurationDays;

  let expiresAt = new Date(
    Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000,
  );
  let updatedToken = await RefreshTokenModel.findOneAndUpdate(
    {
      _id: storedToken._id,
      tokenHash,
    },
    {
      $set: {
        tokenHash: newTokenHash,
        expiresAt,
      },
    },
    { new: true },
  );
  if (!updatedToken) {
    return {
      success: false,
      status: 401,
      message: "Refresh token has already been used or is invalid",
    };
  }
  return {
    success: true,
    accessToken,
    refreshToken: newRefreshToken,
    message: "Tokens refreshed successfully",
  };
};
export const logoutService = async (
  formData: LogoutFormData,
): Promise<LogoutResult> => {
  let { refreshToken } = formData;

  let decoded = verifyRefreshToken(refreshToken);

  if (!decoded) {
    return {
      success: false,
      status: 401,
      message: "Invalid or expired refresh token",
    };
  }

  let tokenHash = hashRefreshToken(refreshToken);

  await RefreshTokenModel.deleteOne({ tokenHash });

  return {
    success: true,
    message: "Logged out successfully",
  };
};
export const logoutAllDevicesService = async (
  userId: string,
): Promise<LogoutResult> => {
  await RefreshTokenModel.deleteMany({ user: userId });

  return {
    success: true,
    message: "Successfully logged out from all devices",
  };
};
