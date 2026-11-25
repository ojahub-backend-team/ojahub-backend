import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  createStockTransferService,
  dispatchStockTransferService,
  receiveStockTransferService,
} from "../services/stockTransfer.service.js";

export const createStockTransferController = tryCatchFn(async (req, res) => {
  const result = await createStockTransferService(
    req.user!._id,
    req.user!.businessId,
    req.body,
  );
  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }
  return sendSuccessResponse(res, result.status, {
    success: true,
    message: result.message,
    body: result.data,
  });
});

export const dispatchStockTransferController = tryCatchFn(async (req, res) => {
  const transferId = Array.isArray(req.params.transferId)
    ? req.params.transferId[0]
    : req.params.transferId;
  if (!transferId) {
    return sendErrorResponse(res, 400, "Transfer ID is required.");
  }
  const result = await dispatchStockTransferService(
    req.user!._id,
    req.user!.businessId,
    transferId,
  );
  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }
  return sendSuccessResponse(res, result.status, {
    success: true,
    message: result.message,
    body: result.data,
  });
});

export const receiveStockTransferController = tryCatchFn(async (req, res) => {
  const transferId = Array.isArray(req.params.transferId)
    ? req.params.transferId[0]
    : req.params.transferId;
  if (!transferId) {
    return sendErrorResponse(res, 400, "Transfer ID is required.");
  }
  const result = await receiveStockTransferService(
    req.user!._id,
    req.user!.businessId,
    transferId,
  );
  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }
  return sendSuccessResponse(res, result.status, {
    success: true,
    message: result.message,
    body: result.data,
  });
});
