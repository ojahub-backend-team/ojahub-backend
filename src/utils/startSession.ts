import type { Request } from "express";
import type { UserRole } from "../models/user.model.js";

const ONE_DAY = 24 * 60 * 60 * 1000; // 1 Day in milliseconds
const THIRTY_DAYS = 30 * ONE_DAY; // 30 Days in milliseconds

type SessionUser = {
  _id: string;
  role: (typeof UserRole)[number];
  businessId?: string;
};

export const startSession = async (
  req: Request,
  user: SessionUser,
  rememberMe = false,
): Promise<void> => {
  // 1. new session ID (stops session fixation)
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  // 2. what the reset of the API needs on every request
  req.session.userId = user._id;
  req.session.role = user.role;
  if (user.businessId) req.session.businessId = user.businessId;

  // 3. "Keep me logged in" decides the cookies lifetime
  req.session.cookie.maxAge = rememberMe ? THIRTY_DAYS : ONE_DAY;

  // 4. make sure it is in mongo before we respond
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
};

export const updateSessionBusiness = async (
  req: Request,
  businessId: string,
): Promise<void> => {
  req.session.businessId = businessId;
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
};
