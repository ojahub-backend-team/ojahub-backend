import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import { createLocationService } from "../services/location.service.js";

export const createLocationController = tryCatchFn(async (req, res) => {
  const result = await createLocationService(req.user!.businessId, req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 201, {
    success: true,
    message: result.message,
    body: {
      location: result.location,
    },
  });
});
