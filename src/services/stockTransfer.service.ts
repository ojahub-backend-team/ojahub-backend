import mongoose, { Types } from "mongoose";
import StockLevelModel from "../models/stockLevel.model.js";
import StockMovementModel from "../models/stockMovement.model.js";
import StockTransferModel, {
  type IStockTransfer,
  type IStockTransferItem,
} from "../models/stockTransfer.model.js";
import BusinessModel from "../models/business.model.js";
import LocationModel from "../models/location.model.js";
import ProductModel from "../models/product.model.js";
import type { CreateStockTransferInput } from "../validators/stockTransfer.validator.js";

type Failure = { success: false; status: number; message: string };
type Success<T> = { success: true; status: number; message: string; data: T };
type Result<T> = Failure | Success<T>;

class StockConflictError extends Error {}
// Checks whether MongoDB rejected an operation because of a duplicate key.
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const validIds = (...ids: string[]) => ids.every((id) => Types.ObjectId.isValid(id));

export const createStockTransferService = async (
  userId: string,
  businessId: string,
  input: CreateStockTransferInput,
): Promise<Result<IStockTransfer>> => {
  if (
    !validIds(
      userId,
      businessId,
      input.sourceLocationId,
      input.destinationLocationId,
      ...input.items.map((item) => item.productId),
    )
  ) {
    return { success: false, status: 400, message: "Invalid ID provided." };
  }
  // Source and destination must be different
  if (
    input.sourceLocationId.toLowerCase() ===
    input.destinationLocationId.toLowerCase()
  ) {
    return {
      success: false,
      status: 400,
      message: "Source and destination locations must be different.",
    };
  }
  const business = await BusinessModel.exists({ _id: businessId });
  if (!business) {
    return { success: false, status: 404, message: "Business not found." };
  }

  const locations = await LocationModel.find({
    _id: { $in: [input.sourceLocationId, input.destinationLocationId] },
    businessId,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (locations.length !== 2) {
    return {
      success: false,
      status: 404,
      message: "One or both locations were not found in this business.",
    };
  }

  const productIds = input.items.map((item) => item.productId);
  const products = await ProductModel.find({
    _id: { $in: productIds },
    businessId,
    isActive: true,
  })
    .select("_id")
    .lean();
  if (products.length !== productIds.length) {
    return {
      success: false,
      status: 404,
      message: "One or more products were not found in this business.",
    };
  }

  const transfer = await StockTransferModel.create({
    businessId,
    sourceLocationId: input.sourceLocationId,
    destinationLocationId: input.destinationLocationId,
    items: input.items,
    notes: input.notes,
    status: "requested",
    requestedBy: userId,
  });
  return {
    success: true,
    status: 201,
    message: "Stock transfer request created.",
    data: transfer,
  };
};

export const dispatchStockTransferService = async (
  userId: string,
  businessId: string,
  transferId: string,
): Promise<Result<IStockTransfer>> => {
  if (!validIds(userId, businessId, transferId)) {
    return { success: false, status: 400, message: "Invalid ID provided." };
  }

  const session = await mongoose.startSession();
  try {
    let response: Result<IStockTransfer> | undefined;
    await session.withTransaction(async () => {
      const transfer = await StockTransferModel.findOne({
        _id: transferId,
        businessId,
        status: "requested",
      }).session(session);
      if (!transfer) {
        const existing = await StockTransferModel.exists({
          _id: transferId,
          businessId,
        }).session(session);
        response = existing
          ? {
              success: false,
              status: 409,
              message: "Only requested transfers can be dispatched.",
            }
          : {
              success: false,
              status: 404,
              message: "Stock transfer not found.",
            };
        return;
      }
      // Ensure the source location is still active
      const sourceLocation = await LocationModel.exists({
        _id: transfer.sourceLocationId,
        businessId,
        isActive: true,
      }).session(session);

      if (!sourceLocation) {
        response = {
          success: false,
          status: 409,
          message: "Source location is inactive or unavailable.",
        };
        return;
      }
      // Ensure the destination location is still active before dispatch
      const destinationLocation = await LocationModel.exists({
        _id: transfer.destinationLocationId,
        businessId,
        isActive: true,
      }).session(session);

      if (!destinationLocation) {
        response = {
          success: false,
          status: 409,
          message: "Destination location is inactive or unavailable.",
        };
        return;
      }

      // Ensure all transferred products are still active
      const productIds = transfer.items.map(
        (item: IStockTransferItem) => item.productId,
      );

      const activeProducts = await ProductModel.find({
        _id: { $in: productIds },
        businessId,
        isActive: true,
      })
        .select("_id")
        .session(session)
        .lean();

      if (activeProducts.length !== productIds.length) {
        response = {
          success: false,
          status: 409,
          message: "One or more products are inactive or unavailable.",
        };
        return;
      }
      const movements: Array<Record<string, unknown>> = [];
      for (const item of transfer.items) {
        const level = await StockLevelModel.findOneAndUpdate(
          {
            businessId,
            locationId: transfer.sourceLocationId,
            productId: item.productId,
            quantity: { $gte: item.quantity },
          },
          { $inc: { quantity: -item.quantity } },
          { new: true, session, runValidators: true },
        );
        if (!level) {
          throw new StockConflictError(
            `Insufficient stock for product ${item.productId}.`,
          );
        }
        movements.push({
          businessId,
          productId: item.productId,
          locationId: transfer.sourceLocationId,
          transferId: transfer._id,
          type: "transfer_out",
          quantityChange: -item.quantity,
          balanceAfter: level.quantity,
          createdBy: userId,
        });
      }

      const updated = await StockTransferModel.findOneAndUpdate(
        { _id: transferId, businessId, status: "requested" },
        {
          $set: {
            status: "in_transit",
            dispatchedBy: userId,
            dispatchedAt: new Date(),
          },
        },
        { new: true, runValidators: true, session },
      );
      if (!updated)
        throw new StockConflictError(
          "Transfer state changed. Retry the request.",
        );
      await StockMovementModel.insertMany(movements, {
        session,
        ordered: true,
      });
      response = {
        success: true,
        status: 200,
        message: "Stock transfer dispatched.",
        data: updated,
      };
    });
    return response ?? { success: false, status: 500, message: "Dispatch failed." };
  } catch (error) {
    if (error instanceof StockConflictError) {
      return { success: false, status: 409, message: error.message };
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const receiveStockTransferService = async (
  userId: string,
  businessId: string,
  transferId: string,
): Promise<Result<IStockTransfer>> => {
  if (!validIds(userId, businessId, transferId)) {
    return { success: false, status: 400, message: "Invalid ID provided." };
  }

  const session = await mongoose.startSession();
  try {
    let response: Result<IStockTransfer> | undefined;
    await session.withTransaction(async () => {
      const transfer = await StockTransferModel.findOne({
        _id: transferId,
        businessId,
        status: "in_transit",
      }).session(session);
      if (!transfer) {
        const existing = await StockTransferModel.exists({
          _id: transferId,
          businessId,
        }).session(session);
        response = existing
          ? {
              success: false,
              status: 409,
              message: "Only in-transit transfers can be received.",
            }
          : {
              success: false,
              status: 404,
              message: "Stock transfer not found.",
            };
        return;
      }

     const destination = await LocationModel.exists({
       _id: transfer.destinationLocationId,
       businessId,
     }).session(session);
      if (!destination) {
        response = {
          success: false,
          status: 404,
          message: "Destination location not found.",
        };
        return;
      }

      const movements: Array<Record<string, unknown>> = [];
      for (const item of transfer.items) {
        const level = await StockLevelModel.findOneAndUpdate(
          {
            businessId,
            locationId: transfer.destinationLocationId,
            productId: item.productId,
          },
          {
            $inc: { quantity: item.quantity },
            $setOnInsert: {
              businessId,
              locationId: transfer.destinationLocationId,
              productId: item.productId,
            },
          },
          {
            new: true,
            upsert: true,
            session,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );
        if (!level)
          throw new Error("Could not update destination stock level.");
        movements.push({
          businessId,
          productId: item.productId,
          locationId: transfer.destinationLocationId,
          transferId: transfer._id,
          type: "transfer_in",
          quantityChange: item.quantity,
          balanceAfter: level.quantity,
          createdBy: userId,
        });
      }

      const updated = await StockTransferModel.findOneAndUpdate(
        { _id: transferId, businessId, status: "in_transit" },
        {
          $set: {
            status: "received",
            receivedBy: userId,
            receivedAt: new Date(),
          },
        },
        { new: true, runValidators: true, session },
      );
      if (!updated)
        throw new StockConflictError(
          "Transfer state changed. Retry the request.",
        );
      await StockMovementModel.insertMany(movements, {
        session,
        ordered: true,
      });
      response = {
        success: true,
        status: 200,
        message: "Stock transfer received.",
        data: updated,
      };
    });
    return (
      response ?? { success: false, status: 500, message: "Receipt failed." }
    );
  } catch (error) {
    if (error instanceof StockConflictError) {
      return { success: false, status: 409, message: error.message };
    }

    // Another transaction may have created the destination stock record first.
    if (isDuplicateKeyError(error)) {
      return {
        success: false,
        status: 409,
        message:
          "Stock levels changed while receiving this transfer. Please retry.",
      };
    }

    throw error;
  } finally {
    await session.endSession();
  }
};
