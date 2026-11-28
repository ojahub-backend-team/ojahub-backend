import mongoose from "mongoose";
import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  addStockService,
  adjustStockService,
  updateStockThresholdService,
  getStockService,
} from "../services/stock.service.js";
import {
  addStockSchema,
  adjustStockSchema,
  updateStockThresholdSchema,
  getStockSchema,
} from "../validators/stock.validator.js";

// Adds stock to a product at a selected location.
export const addStockController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Retrieves the authenticated user's ID as a string.
  const userId = (req as typeof req & { user: { _id: string } }).user._id;

  // Validates the product, location and quantity information.
  const validation = addStockSchema.safeParse(req.body);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock information",
      validation.error.flatten().fieldErrors,
    );
  }

  // Adds the requested quantity and records the stock movement.
  const result = await addStockService(businessId, userId, validation.data);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the updated stock balance and its status.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      stock: result.stock,
      stockStatus: result.stockStatus,
    },
  });
});

// Manually increases or decreases stock and records the adjustment reason.
export const adjustStockController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Retrieves the authenticated user's ID as a string.
  const userId = (req as typeof req & { user: { _id: string } }).user._id;

  // Validates the adjustment type, quantity and reason.
  const validation = adjustStockSchema.safeParse(req.body);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock adjustment information",
      validation.error.flatten().fieldErrors,
    );
  }

  // Applies the adjustment and records the resulting stock movement.
  const result = await adjustStockService(businessId, userId, validation.data);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the updated stock balance and its status.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      stock: result.stock,
      stockStatus: result.stockStatus,
    },
  });
});

// Updates the low-stock and getting-low thresholds for a product at a location.
export const updateStockThresholdController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Extracts the product ID from the route parameters.
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  // Extracts the location ID from the route parameters.
  const locationId = Array.isArray(req.params.locationId)
    ? req.params.locationId[0]
    : req.params.locationId;

  // Validates the threshold values submitted in the request body.
  const validation = updateStockThresholdSchema.safeParse(req.body);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock threshold information",
      validation.error.flatten().fieldErrors,
    );
  }

  // Updates the thresholds for the selected product and location.
  const result = await updateStockThresholdService(
    businessId,
    productId,
    locationId,
    validation.data,
  );

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the stock record with its updated thresholds and status.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      stock: result.stock,
      stockStatus: result.stockStatus,
    },
  });
});

// Retrieves stock records using product, location, status and search filters.
export const getStockController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Validates the stock filters and pagination parameters.
  const validation = getStockSchema.safeParse(req.query);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock query parameters",
      validation.error.flatten().fieldErrors,
    );
  }

  // Retrieves the filtered and paginated stock records.
  const result = await getStockService(businessId, validation.data);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the stock records and pagination information.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Stock records retrieved successfully.",
    body: {
      stocks: result.stocks,
      pagination: result.pagination,
    },
  });
});
