import { type NextFunction, type Request, type Response } from "express";
import { sendErrorResponse } from "../libs/response-handlers.js";
import type { UserRole } from "../models/user.model.js";
import userModel from "../models/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        role: (typeof UserRole)[number];
        businessId: string;
      };
    }
  }
}

export const verifySession = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.session?.userId) {
    return sendErrorResponse(res, 401, "Access denied. Please log in.");
  }

  req.user = {
    _id: req.session.userId,
    role: req.session.role ?? "user",
    businessId: req.session.businessId ?? "",
  };

  next();
};

export const requireRole = (
  ...allowedRoles: Array<(typeof UserRole)[number] | "all">
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.session?.role ?? "user";

    if (
      allowedRoles.includes("all") ||
      allowedRoles.includes(role as (typeof UserRole)[number])
    ) {
      return next();
    }

    return sendErrorResponse(
      res,
      403,
      "Access denied. Insufficient permissions.",
    );
  };
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const role = req.session?.role ?? "user";
  if (role === "admin") {
    return next();
  }

  return sendErrorResponse(res, 403, "Access denied. Admin access required.");
};

export const requireBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.user?.businessId) return next();

    // Session may be stale (e.g. onboarding done on another device): check the database
    const user = await userModel.findById(req.user?._id).select("businessId");

    if (!user?.businessId) {
      return sendErrorResponse(
        res,
        403,
        "Please complete your business setup first",
        { code: "ONBOARDING_REQUIRED" },
      );
    }

    const businessId = user.businessId.toString();
    req.session.businessId = businessId;
    req.user = { ...req.user!, businessId };
    return next();
  } catch (error) {
    next(error);
  }
};
