import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import { saveBusinessStep1Service } from "../services/business.service.js";
import { updateSessionBusiness } from "../utils/startSession.js";

export const saveBusinessStep1Controller = tryCatchFn(async (req, res) => {
  const result = await saveBusinessStep1Service(req.user!._id, req.body);

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
