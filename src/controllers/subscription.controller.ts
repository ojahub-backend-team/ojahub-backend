import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  getSubscriptionStateForUserService,
  listPlans,
} from "../services/subscriptionState.service.js";

export const getSubscriptionController = tryCatchFn(async (req, res) => {
  const result = await getSubscriptionStateForUserService(req.user!._id);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Subscription",
    body: result.state,
  });
});

export const getPlansController = tryCatchFn(async (_req, res) => {
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Available plans",
    body: listPlans(),
  });
});
