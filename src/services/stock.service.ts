import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import LocationModel from "../models/location.model.js";
import StockRecordModel, {
  getStockRecordStatus,
} from "../models/stock-record.model.js";
import StockMovementRecordModel from "../models/stock-movement-record.model.js";

// Defines the information required to add stock to a location.
export type AddStockData = {
  productId: string;
  locationId: string;
  quantity: number;
  note?: string;
};

// Defines the information required to adjust a location's stock balance.
export type AdjustStockData = {
  productId: string;
  locationId: string;
  adjustmentType: "increase" | "decrease";
  quantity: number;
  reason: string;
  note?: string;
};

// Defines the information required to deduct stock after a sale.
export type DeductStockForSaleData = {
  productId: string;
  locationId: string;
  quantity: number;
  saleId: string;
  note?: string;
};

// Defines the optional stock alert thresholds that can be updated.
export type UpdateStockThresholdData = {
  lowStockThreshold?: number;
  gettingLowThreshold?: number;
};

// Defines the filters and pagination options for retrieving stock.
export type GetStockOptions = {
  productId?: string;
  locationId?: string;
  status?: "out_of_stock" | "low_stock" | "getting_low" | "in_stock";
  search?: string;
  page?: number;
  limit?: number;
};

// Defines the standard error response returned by stock services.
type ServiceError = {
  success: false;
  status: number;
  message: string;
};

// Defines the response returned by stock creation, adjustment and threshold services.
type StockResult =
  | {
      success: true;
      stock: any;
      stockStatus: string;
      message: string;
    }
  | ServiceError;

// Defines the response returned when stock is deducted for a sale.
type SaleStockResult =
  | {
      success: true;
      stock: any;
      movement: any;
      stockStatus: string;
      message: string;
    }
  | ServiceError;

// Defines the response returned when stock records are retrieved.
type GetStockResult =
  | {
      success: true;
      stocks: any[];
      pagination: {
        totalStocks: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
      };
    }
  | ServiceError;

// Defines an error that carries the HTTP status expected by the controller.
class StockServiceException extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StockServiceException";
    this.status = status;
  }
}

// Lists all stock statuses accepted by the retrieval service.
const VALID_STOCK_STATUSES = [
  "out_of_stock",
  "low_stock",
  "getting_low",
  "in_stock",
] as const;

// Extracts a readable message from an unknown error value.
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
};

// Checks whether an error was caused by a MongoDB duplicate-key conflict.
const isDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
};

// Checks whether an error was caused by Mongoose document validation.
const isValidationError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ValidationError"
  );
};

// Validates that a supplied value is a positive finite quantity.
const isPositiveQuantity = (quantity: number): boolean => {
  return (
    typeof quantity === "number" &&
    Number.isSafeInteger(quantity) &&
    quantity > 0
  );
};

// Validates that a supplied value is a non-negative finite number.
const isNonNegativeNumber = (value: number): boolean => {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
};

// Escapes special regular-expression characters before searching product names.
const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Validates product and active-location ownership inside the stock transaction.
const validateProductAndLocation = async (
  businessId: string,
  productId: string,
  locationId: string,
  session: mongoose.ClientSession,
): Promise<void> => {
  if (
    !mongoose.Types.ObjectId.isValid(businessId) ||
    !mongoose.Types.ObjectId.isValid(productId) ||
    !mongoose.Types.ObjectId.isValid(locationId)
  ) {
    throw new StockServiceException(
      "Invalid business, product or location ID.",
      400,
    );
  }

  // Checks that the product belongs to the requesting business.
  const product = await ProductModel.findOne({
    _id: productId,
    businessId,
  }).session(session);

  if (!product) {
    throw new StockServiceException("Product not found in this business.", 404);
  }

  // Checks that the location belongs to the business and is currently active.
  const location = await LocationModel.findOne({
    _id: locationId,
    businessId,
    isActive: true,
  }).session(session);

  if (!location) {
    throw new StockServiceException(
      "Active location not found in this business.",
      404,
    );
  }
};

// Converts known stock service exceptions and database errors into service responses.
const handleStockServiceError = (
  error: unknown,
  fallbackMessage: string,
): ServiceError => {
  if (error instanceof StockServiceException) {
    return {
      success: false,
      status: error.status,
      message: error.message,
    };
  }

  if (isDuplicateKeyError(error)) {
    return {
      success: false,
      status: 409,
      message: "A stock record or movement already exists for this operation.",
    };
  }

  if (isValidationError(error)) {
    return {
      success: false,
      status: 400,
      message: getErrorMessage(error),
    };
  }

  return {
    success: false,
    status: 500,
    message: getErrorMessage(error) || fallbackMessage,
  };
};

// Adds stock to a product at a particular location and records the stock movement.
export const addStockService = async (
  businessId: string,
  userId: string,
  data: AddStockData,
): Promise<StockResult> => {
  if (
    !mongoose.Types.ObjectId.isValid(businessId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid business or user ID.",
    };
  }

  if (
    !mongoose.Types.ObjectId.isValid(data.productId) ||
    !mongoose.Types.ObjectId.isValid(data.locationId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid product or location ID.",
    };
  }

  if (!isPositiveQuantity(data.quantity)) {
    return {
      success: false,
      status: 400,
      message: "Stock quantity must be greater than zero.",
    };
  }

  const session = await mongoose.startSession();

  try {
    let result: StockResult = {
      success: false,
      status: 500,
      message: "Unable to add stock.",
    };

    await session.withTransaction(async () => {
      // Confirms product and location ownership before changing the stock balance.
      await validateProductAndLocation(
        businessId,
        data.productId,
        data.locationId,
        session,
      );

      const stockFilter = {
        businessId,
        productId: data.productId,
        locationId: data.locationId,
      };

      // Reads the previous balance so the movement history is accurate.
      const existingStock =
        await StockRecordModel.findOne(stockFilter).session(session);

      const quantityBefore = existingStock?.quantity ?? 0;

      // Adds the received quantity or creates the first stock record.
      const updatedStock = await StockRecordModel.findOneAndUpdate(
        stockFilter,
        {
          $inc: {
            quantity: data.quantity,
          },
          $setOnInsert: {
            businessId,
            productId: data.productId,
            locationId: data.locationId,
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

      if (!updatedStock) {
        throw new Error("Unable to update stock balance.");
      }

      // Records the stock addition in the same transaction as the balance update.
      await StockMovementRecordModel.create(
        [
          {
            businessId,
            productId: data.productId,
            locationId: data.locationId,
            type: "stock_in",
            quantityChange: data.quantity,
            balanceAfter: updatedStock.quantity,
            createdBy: userId,
            quantity: data.quantity,
            quantityBefore,
            quantityAfter: updatedStock.quantity,
            referenceType: "manual",
            reason: "Stock added",
            note: data.note,
            performedBy: userId,
          },
        ],
        { session },
      );

      result = {
        success: true,
        stock: updatedStock,
        stockStatus: getStockRecordStatus(
          updatedStock.quantity,
          updatedStock.lowStockThreshold,
          updatedStock.gettingLowThreshold,
        ),
        message: "Stock added successfully.",
      };
    });

    return result;
  } catch (error: unknown) {
    return handleStockServiceError(error, "Unable to add stock.");
  } finally {
    await session.endSession();
  }
};

// Increases or decreases stock manually and records the adjustment reason.
export const adjustStockService = async (
  businessId: string,
  userId: string,
  data: AdjustStockData,
): Promise<StockResult> => {
  if (
    !mongoose.Types.ObjectId.isValid(businessId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid business or user ID.",
    };
  }

  if (
    !mongoose.Types.ObjectId.isValid(data.productId) ||
    !mongoose.Types.ObjectId.isValid(data.locationId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid product or location ID.",
    };
  }

  if (!["increase", "decrease"].includes(data.adjustmentType)) {
    return {
      success: false,
      status: 400,
      message: "Adjustment type must be increase or decrease.",
    };
  }

  if (!isPositiveQuantity(data.quantity)) {
    return {
      success: false,
      status: 400,
      message: "Adjustment quantity must be greater than zero.",
    };
  }

  if (typeof data.reason !== "string" || !data.reason.trim()) {
    return {
      success: false,
      status: 400,
      message: "An adjustment reason is required.",
    };
  }

  const session = await mongoose.startSession();

  try {
    let result: StockResult = {
      success: false,
      status: 500,
      message: "Unable to adjust stock.",
    };

    await session.withTransaction(async () => {
      // Confirms product and location ownership before changing the stock balance.
      await validateProductAndLocation(
        businessId,
        data.productId,
        data.locationId,
        session,
      );

      const stockFilter = {
        businessId,
        productId: data.productId,
        locationId: data.locationId,
      };

      // Reads the current balance before calculating the adjustment.
      const existingStock =
        await StockRecordModel.findOne(stockFilter).session(session);

      if (data.adjustmentType === "decrease" && !existingStock) {
        throw new StockServiceException(
          "No stock record exists for this product and location.",
          404,
        );
      }

      const quantityBefore = existingStock?.quantity ?? 0;

      if (
        data.adjustmentType === "decrease" &&
        quantityBefore < data.quantity
      ) {
        throw new StockServiceException(
          "Adjustment quantity exceeds available stock.",
          409,
        );
      }

      // Calculates the expected balance after the adjustment.
      const quantityAfter =
        data.adjustmentType === "increase"
          ? quantityBefore + data.quantity
          : quantityBefore - data.quantity;

      // Applies an increase or a guarded decrease without allowing negative stock.
      const updatedStock = await StockRecordModel.findOneAndUpdate(
        data.adjustmentType === "increase"
          ? stockFilter
          : {
              ...stockFilter,
              quantity: { $gte: data.quantity },
            },
        data.adjustmentType === "increase"
          ? {
              $inc: {
                quantity: data.quantity,
              },
              $setOnInsert: {
                businessId,
                productId: data.productId,
                locationId: data.locationId,
              },
            }
          : {
              $inc: {
                quantity: -data.quantity,
              },
            },
        {
          new: true,
          upsert: data.adjustmentType === "increase",
          runValidators: true,
          setDefaultsOnInsert: true,
          session,
        },
      );

      if (!updatedStock) {
        throw new StockServiceException(
          "Stock could not be adjusted. Check the available quantity.",
          409,
        );
      }

      // Records the adjustment and its reason alongside the balance change.
      await StockMovementRecordModel.create(
        [
          {
            businessId,
            productId: data.productId,
            locationId: data.locationId,
            type:
              data.adjustmentType === "increase"
                ? "adjustment_in"
                : "adjustment_out",
            quantityChange:
              data.adjustmentType === "increase"
                ? data.quantity
                : -data.quantity,
            balanceAfter: updatedStock.quantity,
            createdBy: userId,
            quantity: data.quantity,
            quantityBefore,
            quantityAfter: updatedStock.quantity,
            referenceType: "adjustment",
            reason: data.reason.trim(),
            note: data.note,
            performedBy: userId,
          },
        ],
        { session },
      );

      result = {
        success: true,
        stock: updatedStock,
        stockStatus: getStockRecordStatus(
          updatedStock.quantity,
          updatedStock.lowStockThreshold,
          updatedStock.gettingLowThreshold,
        ),
        message: "Stock adjusted successfully.",
      };
    });

    return result;
  } catch (error: unknown) {
    return handleStockServiceError(error, "Unable to adjust stock.");
  } finally {
    await session.endSession();
  }
};

// Deducts stock for a sale while preventing the same sale from deducting it twice.
export const deductStockForSaleService = async (
  businessId: string,
  userId: string,
  data: DeductStockForSaleData,
): Promise<SaleStockResult> => {
  if (
    !mongoose.Types.ObjectId.isValid(businessId) ||
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(data.saleId) ||
    !mongoose.Types.ObjectId.isValid(data.productId) ||
    !mongoose.Types.ObjectId.isValid(data.locationId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid business, user, sale, product or location ID.",
    };
  }

  if (!isPositiveQuantity(data.quantity)) {
    return {
      success: false,
      status: 400,
      message: "Sale quantity must be greater than zero.",
    };
  }

  const session = await mongoose.startSession();

  try {
    let result: SaleStockResult = {
      success: false,
      status: 500,
      message: "Unable to deduct stock for this sale.",
    };

    await session.withTransaction(async () => {
      // Confirms that the product belongs to this business.
      const product = await ProductModel.findOne({
        _id: data.productId,
        businessId,
      }).session(session);

      if (!product) {
        throw new StockServiceException(
          "Product not found in this business.",
          404,
        );
      }

      // Confirms that the sale is being deducted from an active business location.
      const location = await LocationModel.findOne({
        _id: data.locationId,
        businessId,
        isActive: true,
      }).session(session);

      if (!location) {
        throw new StockServiceException(
          "Active location not found in this business.",
          404,
        );
      }

      // Checks whether this sale has already deducted this product at this location.
      const existingMovement = await StockMovementRecordModel.findOne({
        businessId,
        referenceType: "sale",
        referenceId: data.saleId,
        productId: data.productId,
        locationId: data.locationId,
      }).session(session);

      if (existingMovement) {
        throw new StockServiceException(
          "Stock has already been deducted for this sale, product and location.",
          409,
        );
      }

      const stockFilter = {
        businessId,
        productId: data.productId,
        locationId: data.locationId,
        quantity: { $gte: data.quantity },
      };

      // Deducts stock only when the available balance is sufficient.
      const updatedStock = await StockRecordModel.findOneAndUpdate(
        stockFilter,
        {
          $inc: {
            quantity: -data.quantity,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!updatedStock) {
        const currentStock = await StockRecordModel.findOne({
          businessId,
          productId: data.productId,
          locationId: data.locationId,
        }).session(session);

        if (!currentStock) {
          throw new StockServiceException(
            "No stock record exists for this product and location.",
            409,
          );
        }

        throw new StockServiceException(
          "Insufficient stock for this sale.",
          409,
        );
      }

      // Derives the balance before deduction from the returned updated balance.
      const quantityBefore = updatedStock.quantity + data.quantity;

      // Creates the sale movement in the same transaction as the stock deduction.
      const [movement] = await StockMovementRecordModel.create(
        [
          {
            businessId,
            productId: data.productId,
            locationId: data.locationId,
            type: "sale",
            quantityChange: -data.quantity,
            balanceAfter: updatedStock.quantity,
            createdBy: userId,
            quantity: data.quantity,
            quantityBefore,
            quantityAfter: updatedStock.quantity,
            referenceType: "sale",
            referenceId: data.saleId,
            reason: "Stock deducted for sale",
            note: data.note,
            performedBy: userId,
          },
        ],
        { session },
      );

      result = {
        success: true,
        stock: updatedStock,
        movement,
        stockStatus: getStockRecordStatus(
          updatedStock.quantity,
          updatedStock.lowStockThreshold,
          updatedStock.gettingLowThreshold,
        ),
        message: "Stock deducted successfully for this sale.",
      };
    });

    return result;
  } catch (error: unknown) {
    return handleStockServiceError(
      error,
      "Unable to deduct stock for this sale.",
    );
  } finally {
    await session.endSession();
  }
};

// Updates the low-stock alert thresholds for a product at a particular location.
export const updateStockThresholdService = async (
  businessId: string,
  productId: string,
  locationId: string,
  data: UpdateStockThresholdData,
): Promise<StockResult> => {
  if (
    !mongoose.Types.ObjectId.isValid(businessId) ||
    !mongoose.Types.ObjectId.isValid(productId) ||
    !mongoose.Types.ObjectId.isValid(locationId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid business, product or location ID.",
    };
  }

  if (
    data.lowStockThreshold === undefined &&
    data.gettingLowThreshold === undefined
  ) {
    return {
      success: false,
      status: 400,
      message: "At least one stock threshold must be provided.",
    };
  }

  try {
    // Finds the stock record within the requesting business and location.
    const stock = await StockRecordModel.findOne({
      businessId,
      productId,
      locationId,
    });

    if (!stock) {
      return {
        success: false,
        status: 404,
        message: "Stock record not found.",
      };
    }

    const lowStockThreshold = data.lowStockThreshold ?? stock.lowStockThreshold;

    const gettingLowThreshold =
      data.gettingLowThreshold ?? stock.gettingLowThreshold;

    if (!isNonNegativeNumber(lowStockThreshold)) {
      return {
        success: false,
        status: 400,
        message: "Low-stock threshold must be zero or greater.",
      };
    }

    if (!Number.isFinite(gettingLowThreshold) || gettingLowThreshold < 2) {
      return {
        success: false,
        status: 400,
        message: "Getting-low threshold must be at least 2.",
      };
    }

    if (gettingLowThreshold <= lowStockThreshold) {
      return {
        success: false,
        status: 400,
        message:
          "Getting-low threshold must be greater than the low-stock threshold.",
      };
    }

    // Saves the validated thresholds for this product at this location.
    stock.lowStockThreshold = lowStockThreshold;
    stock.gettingLowThreshold = gettingLowThreshold;

    await stock.save();

    return {
      success: true,
      stock,
      stockStatus: getStockRecordStatus(
        stock.quantity,
        stock.lowStockThreshold,
        stock.gettingLowThreshold,
      ),
      message: "Stock thresholds updated successfully.",
    };
  } catch (error: unknown) {
    return handleStockServiceError(error, "Unable to update stock thresholds.");
  }
};

// Retrieves business stock records with optional filters, search and pagination.
export const getStockService = async (
  businessId: string,
  options: GetStockOptions = {},
): Promise<GetStockResult> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID.",
    };
  }

  if (!Number.isInteger(page) || page < 1) {
    return {
      success: false,
      status: 400,
      message: "Page must be a positive integer.",
    };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return {
      success: false,
      status: 400,
      message: "Limit must be between 1 and 100.",
    };
  }

  if (
    options.status !== undefined &&
    !VALID_STOCK_STATUSES.includes(
      options.status as (typeof VALID_STOCK_STATUSES)[number],
    )
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid stock status filter.",
    };
  }

  if (
    options.productId &&
    !mongoose.Types.ObjectId.isValid(options.productId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID.",
    };
  }

  if (
    options.locationId &&
    !mongoose.Types.ObjectId.isValid(options.locationId)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid location ID.",
    };
  }

  try {
    const filter: Record<string, any> = {
      businessId,
    };

    // Applies an exact product filter when a product ID is supplied.
    if (options.productId) {
      filter.productId = options.productId;
    }

    // Applies a location filter when a location ID is supplied.
    if (options.locationId) {
      filter.locationId = options.locationId;
    }

    // Finds products whose names match the requested search text.
    if (options.search?.trim()) {
      const escapedSearch = escapeRegex(options.search.trim());

      const matchingProducts = await ProductModel.find({
        businessId,
        name: {
          $regex: escapedSearch,
          $options: "i",
        },
      })
        .select("_id")
        .lean();

      const matchingProductIds = matchingProducts.map((product) => product._id);

      // Combines the search results with an explicit product ID instead of overwriting it.
      filter.$and = [
        ...(filter.$and ?? []),
        {
          productId: {
            $in: matchingProductIds,
          },
        },
      ];
    }

    // Applies the selected stock status using the same boundaries as getStockStatus.
    if (options.status) {
      const statusConditions: Record<string, any> = {
        out_of_stock: {
          $lte: ["$quantity", 0],
        },
        low_stock: {
          $and: [
            { $gt: ["$quantity", 0] },
            { $lte: ["$quantity", "$lowStockThreshold"] },
          ],
        },
        getting_low: {
          $and: [
            { $gt: ["$quantity", "$lowStockThreshold"] },
            { $lt: ["$quantity", "$gettingLowThreshold"] },
          ],
        },
        in_stock: {
          $gte: ["$quantity", "$gettingLowThreshold"],
        },
      };

      filter.$expr = statusConditions[options.status];
    }

    const skip = (page - 1) * limit;

    // Retrieves the requested stock page and total count for pagination.
    const [stocks, totalStocks] = await Promise.all([
      StockRecordModel.find(filter)
        .populate("productId", "name sku unit image")
        .populate("locationId", "name address")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      StockRecordModel.countDocuments(filter),
    ]);

    // Adds the authoritative stock status to each retrieved stock record.
    const stocksWithStatus = stocks.map((stock: any) => ({
      ...stock,
      stockStatus: getStockRecordStatus(
        stock.quantity,
        stock.lowStockThreshold,
        stock.gettingLowThreshold,
      ),
    }));

    return {
      success: true,
      stocks: stocksWithStatus,
      pagination: {
        totalStocks,
        currentPage: page,
        totalPages: Math.ceil(totalStocks / limit),
        pageSize: limit,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      status: 500,
      message: getErrorMessage(error),
    };
  }
};
