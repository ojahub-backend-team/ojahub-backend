import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  initializeSubscriptionPaymentService,
  verifySubscriptionPaymentService,
  PaymentServiceError,
} from "../services/payment.service.js";

export const initializePaymentController = tryCatchFn(async (req, res) => {
  try {
    const result = await initializeSubscriptionPaymentService(
      req.user!._id,
      req.body.plan,
    );

    return sendSuccessResponse(res, 200, {
      success: true,
      message: "Payment initialized successfully.",
      body: result,
    });
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return sendErrorResponse(res, error.statusCode, error.message);
    }

    throw error;
  }
});

export const verifyPaymentController = tryCatchFn(async (req, res) => {
  try {
    const result = await verifySubscriptionPaymentService(
      req.user!._id,
      String(req.params.reference),
    );

    return sendSuccessResponse(res, 200, {
      success: true,
      message: result.message,
      body: result,
    });
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return sendErrorResponse(res, error.statusCode, error.message);
    }

    throw error;
  }
});
