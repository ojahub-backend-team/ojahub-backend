import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import { getStockMovementsService } from "../services/stock-movement.service.js";
import { getStockMovementsSchema } from "../validators/stock-movement.validator.js";

// Retrieves stock movement history for the authenticated user's business.
export const getStockMovementsController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID as a string.
  const businessId = (req as typeof req & { user: { businessId: string } }).user
    .businessId;

  // Validates the movement filters, date range and pagination parameters.
  const validation = getStockMovementsSchema.safeParse(req.query);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid stock movement query parameters.",
      validation.error.flatten().fieldErrors,
    );
  }

  // Retrieves the filtered and paginated stock movement history.
  const result = await getStockMovementsService(businessId, validation.data);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the movement records and pagination information.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Stock movements retrieved successfully.",
    body: {
      movements: result.movements,
      pagination: result.pagination,
    },
  });
});
