import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import { saveBusinessStep1Service } from "../services/business.service.js";
import { saveFirstLocationService } from "../services/location.service.js";
import { updateSessionBusiness } from "../utils/startSession.js";
import {
  saveFirstProductService,
  skipFirstProductService,
} from "../services/product.service.js";
import { getOnboardingStateService } from "../services/onboarding.service.js";
import { choosePlanService } from "../services/subscription.service.js";

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

export const saveLocationStep2Controller = tryCatchFn(async (req, res) => {
  const result = await saveFirstLocationService(req.user!._id, req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      location: result.location,
      onboardingStep: result.onboardingStep,
    },
  });
});

export const saveProductStep3Controller = tryCatchFn(async (req, res) => {
  const result = await saveFirstProductService(req.user!._id, req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      product: result.product,
      stock: result.stock,
      onboardingStep: result.onboardingStep,
    },
  });
});

export const skipProductStep3Controller = tryCatchFn(async (req, res) => {
  const result = await skipFirstProductService(req.user!._id);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      onboardingStep: result.onboardingStep,
    },
  });
});

export const savePlanStep4Controller = tryCatchFn(async (req, res) => {
  const result = await choosePlanService(req.user!._id, req.body.plan);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  if (result.type === "trial") {
    return sendSuccessResponse(res, 200, {
      success: true,
      message: result.message,
      body: {
        type: "trial",
        subscription: result.subscription,
        onboardingStep: result.onboardingStep,
      },
    });
  }

  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      type: "payment",
      payment: result.payment,
      onboardingStep: result.onboardingStep,
    },
  });
});

export const getOnboardingStateController = tryCatchFn(async (req, res) => {
  const result = await getOnboardingStateService(req.user!._id);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Onboarding progress",
    body: result.state,
  });
});
