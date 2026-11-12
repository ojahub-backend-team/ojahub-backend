import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";

export const generateOtp = (): string => {
  let otp = randomInt(0, 1000000).toString().padStart(6, "0");

  return otp;
};
export const hashOtp = async (otp: string): Promise<string> => {
  let hashedOtp = await bcrypt.hash(otp, 10);

  return hashedOtp;
};
export const getOtpExpiry = (minutes: number = 1): Date => {
  let expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  return expiresAt;
};
export const prepareOtp = async (expiryMinutes: number = 1) => {
  let otp = generateOtp();
  let hashedOtp = await hashOtp(otp);
  let expiresAt = getOtpExpiry(expiryMinutes);
  let now = new Date();

  return {
    otp,
    otpData: {
      code: hashedOtp,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      resendCount: 0,
      resendWindowStartedAt: now,
    },
  };
};
