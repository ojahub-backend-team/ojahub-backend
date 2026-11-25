import type { NextFunction, Request, Response } from "express";
import { sendErrorResponse } from "../libs/response-handlers.js";
import { getSubscriptionStateForBusiness } from "../services/subscriptionState.service.js";

// Reading is always allowed, even after the subscription ends
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

//Use after verifySession and requireBusiness, on the trader's own business routes only.
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (READ_ONLY_METHODS.has(req.method)) return next();

    // The business ID comes from the session or the user record, never from the request body
    const businessId = req.user?.businessId;

    if (!businessId) {
      return sendErrorResponse(
        res,
        403,
        "Please complete your business setup first",
        { code: "ONBOARDING_REQUIRED" },
      );
    }

    const state = await getSubscriptionStateForBusiness(businessId);

    if (state.status === "none") {
      return sendErrorResponse(
        res,
        403,
        "Choose a plan to start your free trial",
        { code: "SUBSCRIPTION_REQUIRED" },
      );
    }

    if (state.status === "expired") {
      return sendErrorResponse(
        res,
        403,
        "Your subscription has ended. You can still view your data, but you need to renew to make changes.",
        { code: "SUBSCRIPTION_EXPIRED" },
      );
    }

    return next();
  } catch (error) {
    next(error);
  }
};
