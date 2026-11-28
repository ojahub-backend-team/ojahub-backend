import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  createStockTransferService,
  getStockTransfersService,
} from "../services/stock-transfer.service.js";
import {
  createStockTransferSchema,
  getStockTransfersSchema,
} from "../validators/stock-transfer.validator.js";

// Transfers stock from one location to another within the same business.
export const createStockTransferController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Retrieves the authenticated user's ID as a string.
  const userId = (req as typeof req & { user: { _id: string } }).user._id;

  // Validates the product, source location, destination location and quantity.
  const validation = createStockTransferSchema.safeParse(req.body);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock transfer information",
      validation.error.flatten().fieldErrors,
    );
  }

  // Creates the transfer and updates both locations' stock balances.
  const result = await createStockTransferService(
    validation.data,
    businessId,
    userId,
  );

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the completed transfer record.
  return sendSuccessResponse(res, 201, {
    success: true,
    message: result.message,
    body: {
      transfer: result.transfer,
    },
  });
});

// Retrieves stock transfers belonging to the authenticated user's business.
export const getStockTransfersController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Validates the transfer filters and pagination parameters.
  const validation = getStockTransfersSchema.safeParse(req.query);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock transfer query parameters",
      validation.error.flatten().fieldErrors,
    );
  }

  // Retrieves the filtered and paginated transfer history.
  const result = await getStockTransfersService(businessId, validation.data);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the transfer records and pagination information.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Stock transfers retrieved successfully.",
    body: {
      transfers: result.transfers,
      pagination: result.pagination,
    },
  });
});
