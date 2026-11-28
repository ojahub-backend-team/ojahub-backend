import type { Request } from "express";
import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  createStoreLocationService,
  getStoreLocationsService,
  getStoreLocationByIdService,
  updateStoreLocationService,
} from "../services/store.service.js";
import {
  createStoreSchema,
  updateStoreSchema,
  getStoresSchema,
} from "../validators/store.validator.js";

// Defines authenticated request fields used by store controllers.
type AuthenticatedRequest = Request & {
  user: { _id: string; businessId: string };
};

// Creates a store using the existing Location model and its shop/warehouse types.
export const createStoreController = tryCatchFn(async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const validation = createStoreSchema.safeParse(req.body);
  if (!validation.success)
    return sendErrorResponse(
      res,
      400,
      "Invalid store information",
      validation.error.flatten().fieldErrors,
    );
  const result = await createStoreLocationService(
    validation.data,
    user.businessId,
  );
  if (!result.success)
    return sendErrorResponse(res, result.status, result.message);
  return sendSuccessResponse(res, 201, {
    success: true,
    message: result.message,
    body: { store: result.location },
  });
});

// Retrieves stores from the business's existing Location records.
export const getStoresController = tryCatchFn(async (req, res) => {
  const businessId = (req as AuthenticatedRequest).user.businessId;
  const validation = getStoresSchema.safeParse(req.query);
  if (!validation.success)
    return sendErrorResponse(
      res,
      400,
      "Invalid store query parameters",
      validation.error.flatten().fieldErrors,
    );
  const result = await getStoreLocationsService(businessId, validation.data);
  if (!result.success)
    return sendErrorResponse(res, result.status, result.message);
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Stores retrieved successfully",
    body: { stores: result.locations, pagination: result.pagination },
  });
});

// Retrieves one store location within the authenticated business.
export const getStoreByIdController = tryCatchFn(async (req, res) => {
  const businessId = (req as AuthenticatedRequest).user.businessId;
  const storeId = Array.isArray(req.params.storeId)
    ? req.params.storeId[0]
    : req.params.storeId;
  const result = await getStoreLocationByIdService(storeId, businessId);
  if (!result.success)
    return sendErrorResponse(res, result.status, result.message);
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Store retrieved successfully",
    body: { store: result.location },
  });
});

// Updates a store location without replacing ZIP 2's Location model.
export const updateStoreController = tryCatchFn(async (req, res) => {
  const businessId = (req as AuthenticatedRequest).user.businessId;
  const storeId = Array.isArray(req.params.storeId)
    ? req.params.storeId[0]
    : req.params.storeId;
  const validation = updateStoreSchema.safeParse(req.body);
  if (!validation.success)
    return sendErrorResponse(
      res,
      400,
      "Invalid store update information",
      validation.error.flatten().fieldErrors,
    );
  const result = await updateStoreLocationService(
    storeId,
    businessId,
    validation.data,
  );
  if (!result.success)
    return sendErrorResponse(res, result.status, result.message);
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: { store: result.location },
  });
});
