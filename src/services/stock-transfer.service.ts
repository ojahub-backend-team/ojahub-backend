import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import LocationModel from "../models/location.model.js";
import StockRecordModel from "../models/stock-record.model.js";
import StockTransferModel from "../models/stockTransfer.model.js";
import StockMovementRecordModel from "../models/stock-movement-record.model.js";

// Describes the information required to transfer stock between locations.
type CreateStockTransferData = {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string;
};

// Describes filters for retrieving stock transfers.
type GetStockTransfersOptions = {
  productId?: string;
  locationId?: string;
  status?: "pending" | "completed" | "cancelled";
  page?: number;
  limit?: number;
};

// Describes a standard service error.
type ServiceError = {
  success: false;
  status: number;
  message: string;
};

// Describes the result of creating a stock transfer.
type StockTransferResult =
  | {
      success: true;
      transfer: unknown;
      message: string;
    }
  | ServiceError;

// Describes the result of retrieving stock transfers.
type GetStockTransfersResult =
  | {
      success: true;
      transfers: unknown[];
      pagination: {
        totalTransfers: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
      };
    }
  | ServiceError;

// Checks that the product and both locations belong to the same business.
const validateTransferOwnership = async (
  productId: mongoose.Types.ObjectId,
  fromLocationId: mongoose.Types.ObjectId,
  toLocationId: mongoose.Types.ObjectId,
  businessId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession,
): Promise<ServiceError | null> => {
  // Confirms that the product belongs to the requesting business.
  const product = await ProductModel.findOne({
    _id: productId,
    businessId,
  })
    .select("_id")
    .session(session)
    .lean();

  if (!product) {
    return {
      success: false,
      status: 404,
      message: "Product not found in this business.",
    };
  }

  // Confirms that the source location belongs to the business and is active.
  const sourceLocation = await LocationModel.findOne({
    _id: fromLocationId,
    businessId,
    isActive: true,
  })
    .select("_id")
    .session(session)
    .lean();

  // Confirms that the destination location belongs to the business and is active.
  const destinationLocation = await LocationModel.findOne({
    _id: toLocationId,
    businessId,
    isActive: true,
  })
    .select("_id")
    .session(session)
    .lean();

  if (!sourceLocation || !destinationLocation) {
    return {
      success: false,
      status: 404,
      message: "Both locations must exist and be active in this business.",
    };
  }

  return null;
};

// Transfers stock atomically and records outgoing and incoming movements.
export const createStockTransferService = async (
  formData: CreateStockTransferData,
  businessId: string,
  userId: string,
): Promise<StockTransferResult> => {
  // Validates the business and user IDs before starting a transaction.
  if (
    !mongoose.Types.ObjectId.isValid(businessId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID or user ID.",
    };
  }

  // Validates the product and location IDs.
  if (
    !mongoose.Types.ObjectId.isValid(formData.productId) ||
    !mongoose.Types.ObjectId.isValid(formData.fromLocationId) ||
    !mongoose.Types.ObjectId.isValid(formData.toLocationId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID or location ID.",
    };
  }

  // Prevents transferring stock to the same location.
  if (formData.fromLocationId === formData.toLocationId) {
    return {
      success: false,
      status: 400,
      message: "Source and destination locations must be different.",
    };
  }

  // Ensures that the transfer quantity is a valid positive number.
  if (!Number.isSafeInteger(formData.quantity) || formData.quantity <= 0) {
    return {
      success: false,
      status: 400,
      message: "Transfer quantity must be greater than zero.",
    };
  }

  // Converts validated IDs into ObjectId values for database operations.
  const businessObjectId = new mongoose.Types.ObjectId(businessId);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const productId = new mongoose.Types.ObjectId(formData.productId);
  const fromLocationId = new mongoose.Types.ObjectId(formData.fromLocationId);
  const toLocationId = new mongoose.Types.ObjectId(formData.toLocationId);

  const session = await mongoose.startSession();

  let result: StockTransferResult = {
    success: false,
    status: 500,
    message: "Unable to complete stock transfer.",
  };

  try {
    // Executes the stock updates and movement records as one atomic operation.
    await session.withTransaction(async () => {
      // Checks product and location ownership inside the transaction.
      const ownershipError = await validateTransferOwnership(
        productId,
        fromLocationId,
        toLocationId,
        businessObjectId,
        session,
      );

      if (ownershipError) {
        result = ownershipError;
        return;
      }

      // Defines the source stock record for this product and business.
      const sourceFilter = {
        businessId: businessObjectId,
        productId,
        locationId: fromLocationId,
      };

      // Defines the destination stock record for this product and business.
      const destinationFilter = {
        businessId: businessObjectId,
        productId,
        locationId: toLocationId,
      };

      // Retrieves the source stock within the transaction.
      const sourceStock =
        await StockRecordModel.findOne(sourceFilter).session(session);

      // Stops the transfer if the source has insufficient stock.
      if (!sourceStock || sourceStock.quantity < formData.quantity) {
        result = {
          success: false,
          status: 400,
          message: "Insufficient stock in the source location.",
        };
        return;
      }

      // Retrieves the destination stock before updating its balance.
      const destinationStock =
        await StockRecordModel.findOne(destinationFilter).session(session);

      const sourceQuantityBefore = sourceStock.quantity;
      const destinationQuantityBefore = destinationStock?.quantity ?? 0;

      const sourceQuantityAfter = sourceQuantityBefore - formData.quantity;

      const destinationQuantityAfter =
        destinationQuantityBefore + formData.quantity;

      // Deducts stock from the source while preventing a negative balance.
      const updatedSourceStock = await StockRecordModel.findOneAndUpdate(
        {
          ...sourceFilter,
          quantity: { $gte: formData.quantity },
        },
        {
          $inc: { quantity: -formData.quantity },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!updatedSourceStock) {
        result = {
          success: false,
          status: 400,
          message: "Insufficient stock in the source location.",
        };
        return;
      }

      // Adds stock to the destination, creating a record when one does not exist.
      const updatedDestinationStock = await StockRecordModel.findOneAndUpdate(
        destinationFilter,
        {
          $setOnInsert: {
            businessId: businessObjectId,
            productId,
            locationId: toLocationId,
          },
          $inc: {
            quantity: formData.quantity,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          session,
        },
      );

      if (!updatedDestinationStock) {
        throw new Error("Unable to update destination stock.");
      }

      // Creates a completed transfer record linked to both stock movements.
      const [transfer] = await StockTransferModel.create(
        [
          {
            businessId: businessObjectId,
            productId,
            fromLocationId,
            toLocationId,
            quantity: formData.quantity,
            status: "completed",
            note: formData.note,
            initiatedBy: userObjectId,
            completedBy: userObjectId,
            transferredAt: new Date(),
          },
        ],
        { session },
      );

      // Records the deduction and addition in the stock movement history.
      await StockMovementRecordModel.create(
        [
          {
            businessId: businessObjectId,
            productId,
            locationId: fromLocationId,
            type: "transfer_out",
            quantityChange: -formData.quantity,
            balanceAfter: updatedSourceStock.quantity,
            createdBy: userObjectId,
            quantity: formData.quantity,
            quantityBefore: sourceQuantityBefore,
            quantityAfter: sourceQuantityAfter,
            referenceType: "transfer",
            referenceId: transfer._id,
            note: formData.note,
            performedBy: userObjectId,
          },
          {
            businessId: businessObjectId,
            productId,
            locationId: toLocationId,
            type: "transfer_in",
            quantityChange: formData.quantity,
            balanceAfter: updatedDestinationStock.quantity,
            createdBy: userObjectId,
            quantity: formData.quantity,
            quantityBefore: destinationQuantityBefore,
            quantityAfter: destinationQuantityAfter,
            referenceType: "transfer",
            referenceId: transfer._id,
            note: formData.note,
            performedBy: userObjectId,
          },
        ],
        { session },
      );

      // Returns the successfully created transfer.
      result = {
        success: true,
        transfer,
        message: "Stock transferred successfully.",
      };
    });

    return result;
  } catch (error) {
    // Returns validation errors caused by invalid transfer data.
    if (error instanceof mongoose.Error.ValidationError) {
      return {
        success: false,
        status: 400,
        message: String(error),
      };
    }

    // Handles duplicate stock records or other unique-index conflicts.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return {
        success: false,
        status: 409,
        message: "A conflicting stock record already exists. Please try again.",
      };
    }

    // Returns a general error when the transfer transaction fails.
    return {
      success: false,
      status: 500,
      message: "An error occurred while transferring stock.",
    };
  } finally {
    // Closes the database session after the transaction finishes.
    await session.endSession();
  }
};

// Retrieves transfers belonging to a business with optional filters and pagination.
export const getStockTransfersService = async (
  businessId: string,
  options: GetStockTransfersOptions,
): Promise<GetStockTransfersResult> => {
  // Validates the business ID before querying transfer records.
  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID.",
    };
  }

  // Converts the validated business ID for database queries.
  const businessObjectId = new mongoose.Types.ObjectId(businessId);

  const page = options.page ?? 1;
  const limit = options.limit ?? 10;

  // Validates pagination values before querying the database.
  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return {
      success: false,
      status: 400,
      message: "Page must be at least 1 and limit must be between 1 and 100.",
    };
  }

  const skip = (page - 1) * limit;

  // Builds the business-scoped transfer search filter.
  const filter: Record<string, unknown> = {
    businessId: businessObjectId,
  };

  // Filters transfers by product when a product ID is supplied.
  if (options.productId) {
    if (!mongoose.Types.ObjectId.isValid(options.productId)) {
      return {
        success: false,
        status: 400,
        message: "Invalid product ID.",
      };
    }

    filter.productId = new mongoose.Types.ObjectId(options.productId);
  }

  // Finds transfers where the selected location is either the source or destination.
  if (options.locationId) {
    if (!mongoose.Types.ObjectId.isValid(options.locationId)) {
      return {
        success: false,
        status: 400,
        message: "Invalid location ID.",
      };
    }

    const locationId = new mongoose.Types.ObjectId(options.locationId);

    filter.$or = [{ fromLocationId: locationId }, { toLocationId: locationId }];
  }

  // Filters transfers by their current status.
  if (options.status) {
    if (!["pending", "completed", "cancelled"].includes(options.status)) {
      return {
        success: false,
        status: 400,
        message: "Invalid stock transfer status.",
      };
    }

    filter.status = options.status;
  }

  try {
    // Retrieves matching transfers and their total count.
    const [transfers, totalTransfers] = await Promise.all([
      StockTransferModel.find(filter)
        .populate("productId", "name sku unit")
        .populate("fromLocationId", "name address")
        .populate("toLocationId", "name address")
        .populate("initiatedBy", "name email")
        .populate("completedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      StockTransferModel.countDocuments(filter),
    ]);

    // Returns the transfer records with pagination information.
    return {
      success: true,
      transfers,
      pagination: {
        totalTransfers,
        currentPage: page,
        totalPages: Math.ceil(totalTransfers / limit),
        pageSize: limit,
      },
    };
  } catch {
    // Returns an error when the transfer history cannot be retrieved.
    return {
      success: false,
      status: 500,
      message: "Unable to retrieve stock transfers.",
    };
  }
};
