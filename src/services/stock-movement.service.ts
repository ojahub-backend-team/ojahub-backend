import mongoose from "mongoose";
import StockMovementRecordModel, {
  type StockMovementReferenceType,
  type StockMovementType,
} from "../models/stock-movement-record.model.js";

// Describes filters for retrieving stock movement history.
type GetStockMovementsOptions = {
  productId?: string;
  locationId?: string;
  type?: StockMovementType;
  referenceType?: StockMovementReferenceType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
};

// Describes a standard service error.
type ServiceError = {
  success: false;
  status: number;
  message: string;
};

// Describes the result of retrieving stock movement history.
type GetStockMovementsResult =
  | {
      success: true;
      movements: unknown[];
      pagination: {
        totalMovements: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
      };
    }
  | ServiceError;

// Defines the movement types supported by the Stock Movement model.
const VALID_MOVEMENT_TYPES: StockMovementType[] = [
  "opening_stock",
  "stock_in",
  "stock_out",
  "purchase",
  "sale",
  "adjustment_in",
  "adjustment_out",
  "transfer_in",
  "transfer_out",
  "return_in",
  "return_out",
];

// Defines the reference types supported by the Stock Movement model.
const VALID_REFERENCE_TYPES: StockMovementReferenceType[] = [
  "transfer",
  "sale",
  "purchase",
  "adjustment",
  "manual",
  "other",
];

// Retrieves stock movements belonging to a business with filters and pagination.
export const getStockMovementsService = async (
  businessId: string,
  options: GetStockMovementsOptions,
): Promise<GetStockMovementsResult> => {
  // Validates the business ID before querying movement records.
  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID.",
    };
  }

  // Converts the validated business ID into an ObjectId for database operations.
  const businessObjectId = new mongoose.Types.ObjectId(businessId);

  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

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

  // Validates the product ID when a product filter is provided.
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

  // Validates the location ID when a location filter is provided.
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

  // Validates the requested movement type against supported values.
  if (options.type && !VALID_MOVEMENT_TYPES.includes(options.type)) {
    return {
      success: false,
      status: 400,
      message: "Invalid stock movement type.",
    };
  }

  // Validates the requested reference type against supported values.
  if (
    options.referenceType &&
    !VALID_REFERENCE_TYPES.includes(options.referenceType)
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid stock movement reference type.",
    };
  }

  // Validates supplied date values.
  if (
    (options.startDate &&
      !(
        options.startDate instanceof Date &&
        Number.isFinite(options.startDate.getTime())
      )) ||
    (options.endDate &&
      !(
        options.endDate instanceof Date &&
        Number.isFinite(options.endDate.getTime())
      ))
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid movement date provided.",
    };
  }

  // Ensures the start date does not come after the end date.
  if (
    options.startDate &&
    options.endDate &&
    options.startDate > options.endDate
  ) {
    return {
      success: false,
      status: 400,
      message: "Start date cannot be later than end date.",
    };
  }

  const skip = (page - 1) * limit;

  // Builds the business-scoped movement search filter.
  const filter: Record<string, unknown> = {
    businessId: businessObjectId,
  };

  // Applies the product filter when a product ID is provided.
  if (options.productId) {
    filter.productId = new mongoose.Types.ObjectId(options.productId);
  }

  // Applies the location filter when a location ID is provided.
  if (options.locationId) {
    filter.locationId = new mongoose.Types.ObjectId(options.locationId);
  }

  // Applies the movement type filter when provided.
  if (options.type) {
    filter.type = options.type;
  }

  // Applies the reference type filter when provided.
  if (options.referenceType) {
    filter.referenceType = options.referenceType;
  }

  // Applies the requested date range to movement creation dates.
  if (options.startDate || options.endDate) {
    const createdAt: Record<string, Date> = {};

    if (options.startDate) {
      createdAt.$gte = options.startDate;
    }

    if (options.endDate) {
      createdAt.$lte = options.endDate;
    }

    filter.createdAt = createdAt;
  }

  try {
    // Retrieves matching movements and their total count.
    const [movements, totalMovements] = await Promise.all([
      StockMovementRecordModel.find(filter)
        .populate("productId", "name sku unit")
        .populate("locationId", "name address")
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      StockMovementRecordModel.countDocuments(filter),
    ]);

    // Returns the movement records with pagination information.
    return {
      success: true,
      movements,
      pagination: {
        totalMovements,
        currentPage: page,
        totalPages: Math.ceil(totalMovements / limit),
        pageSize: limit,
      },
    };
  } catch {
    // Returns a service error if the movement history cannot be retrieved.
    return {
      success: false,
      status: 500,
      message: "Unable to retrieve stock movement history.",
    };
  }
};
