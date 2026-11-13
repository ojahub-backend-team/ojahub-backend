import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  BUSINESS_CATEGORIES,
  saveBusinessStep1Service,
} from "../services/business.service.js";
import { updateSessionBusiness } from "../utils/startSession.js";

export const saveBusinessStep1Controller = tryCatchFn(async (req, res) => {
  const { name, category, businessLocation } = req.body ?? {};

  // Temporary checks: the Zod middleware (P0.6) replaces these
  if (!name?.trim() || !category || !businessLocation?.trim()) {
    return sendErrorResponse(
      res,
      400,
      "Business name, what you sell and business location are required",
    );
  }
  if (!BUSINESS_CATEGORIES.includes(category)) {
    return sendErrorResponse(res, 400, "Invalid business category");
  }

  const result = await saveBusinessStep1Service(req.user!._id, {
    name: name.trim(),
    category,
    businessLocation: businessLocation.trim(),
  });

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  await updateSessionBusiness(req, result.business._id);

  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      business: result.business,
      onboardingStep: result.onboardingStep,
    },
  });
});
