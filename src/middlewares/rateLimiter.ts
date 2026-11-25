import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 6 * 1000;

const tooMany = (message: string) => ({ success: false, message });

//Every attempt counts: each one can create a user or send an email
export const registerRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many login attempts. Please try again later."),
});

// Only failed logins count, so many traders behind one market IP are not blocked.
// The per-account lockout in loginUserService still stops password guessing.
export const loginRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many login attempts. Please try again later."),
});

export const googleRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany(
    "Too many Google sign-in attempts. Please tray again later.",
  ),
});

//Only wrong or failed codes count. The service also locks a code after 5 wrong
export const verifyEmailRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 15,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: "Too many verifications attempts. Please try again later.",
});

//Every request counts: each one sends an email
export const resendOtpRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many code requests. Please try again later."),
});

//Must count every request: this route always answer 200, so skipSuccessfulRequests
// would uncount everything and there would be no limit at all
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: false,
  message: tooMany("Too many password reset request. Please try again later."),
});

//Only wrong codes count
export const resetPasswordRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many password reset attempts. Please try again later."),
});
