import { registerUserService } from "../services/auth.service.js";
import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";

export const registerUserController = tryCatchFn(async (req, res) => {
  const result = await registerUserService(req.body);
  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }
  return sendSuccessResponse(res, 201, {
    success: true,
    message: "User registered successfully",
    body: {
      user: result.user,
    },
  });
});
