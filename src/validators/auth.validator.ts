import { z } from "zod";
import { BUSINESS_CATEGORIES } from "../services/business.service.js";

// 0801..., 234801... and +234801... all become +234801...
export const normalizeNigerianPhone = (value: string): string | null => {
  const digits = value.replace(/[\s()-]/g, "");
  if (/^\+234\d{10}$/.test(digits)) return digits;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  return null;
};

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Enter a valid email address");

const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeNigerianPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Nigerian phone number",
      });
      return z.NEVER;
    }
    return normalized;
  });

const otp = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

// Strength rules (Figma vs code) are still a pending decision: the service keeps its own check for now
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

// Login accepts an email OR a phone, in any of the usual formats
const emailOrPhone = z
  .string()
  .trim()
  .min(1, "Enter your email or phone number")
  .transform((value) =>
    value.includes("@")
      ? value.toLowerCase()
      : (normalizeNigerianPhone(value) ?? value),
  );

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email,
  phone,
  password: newPassword,
});

export const verifyEmailSchema = z.object({ email, otp });

export const resendOtpSchema = z.object({ email });

export const loginSchema = z.object({
  emailOrPhone,
  password: z.string().min(1, "Enter your password").max(128),
  rememberMe: z.boolean().optional().default(false),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "Google token is required"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ email, otp, newPassword });

export const businessStep1Schema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(100),
  category: z.enum(BUSINESS_CATEGORIES),
  businessLocation: z
    .string()
    .trim()
    .min(2, "Enter your business location")
    .max(200),
});
