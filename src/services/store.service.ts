import mongoose from "mongoose";
import LocationModel, { type LocationType } from "../models/location.model.js";

// Describes fields accepted when creating a managed store location.
type CreateManagedLocationData = {
  name: string;
  type: LocationType;
  address: string;
  isDefault?: boolean;
};

// Describes fields accepted when updating a managed store location.
type UpdateManagedLocationData = Partial<CreateManagedLocationData> & {
  isActive?: boolean;
};

// Describes filters for listing managed store locations.
type GetManagedLocationsOptions = {
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

// Creates a store location and makes it default when it is the business's first location.
export const createStoreLocationService = async (
  formData: CreateManagedLocationData,
  businessId: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(businessId))
    return {
      success: false as const,
      status: 400,
      message: "Invalid business ID.",
    };
  const businessObjectId = new mongoose.Types.ObjectId(businessId);
  const session = await mongoose.startSession();
  let createdLocation: unknown;
  try {
    await session.withTransaction(async () => {
      const count = await LocationModel.countDocuments({
        businessId: businessObjectId,
      }).session(session);
      const isDefault = formData.isDefault ?? count === 0;
      if (isDefault)
        await LocationModel.updateMany(
          { businessId: businessObjectId, isDefault: true },
          { $set: { isDefault: false } },
          { session },
        );
      const [location] = await LocationModel.create(
        [{ ...formData, businessId: businessObjectId, isDefault }],
        { session },
      );
      createdLocation = location;
    });
    if (!createdLocation)
      return {
        success: false as const,
        status: 500,
        message: "Unable to create store location.",
      };
    return {
      success: true as const,
      location: createdLocation,
      message: "Store location created successfully.",
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
      return {
        success: false as const,
        status: 409,
        message: "A location with this name already exists in this business.",
      };
    if (error instanceof Error && error.name === "ValidationError")
      return { success: false as const, status: 400, message: error.message };
    throw error;
  } finally {
    await session.endSession();
  }
};

// Retrieves locations belonging to a business with search and pagination.
export const getStoreLocationsService = async (
  businessId: string,
  options: GetManagedLocationsOptions = {},
) => {
  if (!mongoose.Types.ObjectId.isValid(businessId))
    return {
      success: false as const,
      status: 400,
      message: "Invalid business ID.",
    };
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    return {
      success: false as const,
      status: 400,
      message: "Invalid pagination values.",
    };
  const filter: Record<string, unknown> = {
    businessId: new mongoose.Types.ObjectId(businessId),
  };
  if (options.search?.trim())
    filter.name = {
      $regex: options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  if (options.isActive !== undefined)
    filter.isActive = options.isActive === "true";
  const [locations, totalStores] = await Promise.all([
    LocationModel.find(filter)
      .sort({ isDefault: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LocationModel.countDocuments(filter),
  ]);
  return {
    success: true as const,
    locations,
    pagination: {
      totalStores,
      currentPage: page,
      totalPages: Math.ceil(totalStores / limit),
      pageSize: limit,
    },
  };
};

// Retrieves one location only when it belongs to the authenticated business.
export const getStoreLocationByIdService = async (
  locationId: string,
  businessId: string,
) => {
  if (
    !mongoose.Types.ObjectId.isValid(locationId) ||
    !mongoose.Types.ObjectId.isValid(businessId)
  )
    return {
      success: false as const,
      status: 400,
      message: "Invalid location or business ID.",
    };
  const location = await LocationModel.findOne({
    _id: locationId,
    businessId,
  }).lean();
  if (!location)
    return {
      success: false as const,
      status: 404,
      message: "Store location not found.",
    };
  return { success: true as const, location };
};

// Updates a location while preserving one active default location per business.
export const updateStoreLocationService = async (
  locationId: string,
  businessId: string,
  formData: UpdateManagedLocationData,
) => {
  if (
    !mongoose.Types.ObjectId.isValid(locationId) ||
    !mongoose.Types.ObjectId.isValid(businessId)
  )
    return {
      success: false as const,
      status: 400,
      message: "Invalid location or business ID.",
    };
  const session = await mongoose.startSession();
  let updatedLocation: unknown;
  try {
    await session.withTransaction(async () => {
      const existing = await LocationModel.findOne({
        _id: locationId,
        businessId,
      }).session(session);
      if (!existing) throw new Error("LOCATION_NOT_FOUND");
      if (
        existing.isDefault &&
        (formData.isDefault === false || formData.isActive === false)
      )
        throw new Error("DEFAULT_LOCATION_PROTECTED");
      if (formData.isDefault === true)
        await LocationModel.updateMany(
          { businessId, isDefault: true, _id: { $ne: locationId } },
          { $set: { isDefault: false } },
          { session },
        );
      updatedLocation = await LocationModel.findOneAndUpdate(
        { _id: locationId, businessId },
        { $set: formData },
        { new: true, runValidators: true, session },
      ).lean();
      if (!updatedLocation) throw new Error("LOCATION_NOT_FOUND");
    });
    if (!updatedLocation)
      return {
        success: false as const,
        status: 500,
        message: "Unable to update store location.",
      };
    return {
      success: true as const,
      location: updatedLocation,
      message: "Store location updated successfully.",
    };
  } catch (error) {
    if (error instanceof Error && error.message === "LOCATION_NOT_FOUND")
      return {
        success: false as const,
        status: 404,
        message: "Store location not found.",
      };
    if (
      error instanceof Error &&
      error.message === "DEFAULT_LOCATION_PROTECTED"
    )
      return {
        success: false as const,
        status: 400,
        message:
          "Assign another default location before deactivating or unsetting this location.",
      };
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
      return {
        success: false as const,
        status: 409,
        message: "A location with this name already exists in this business.",
      };
    if (error instanceof Error && error.name === "ValidationError")
      return { success: false as const, status: 400, message: error.message };
    throw error;
  } finally {
    await session.endSession();
  }
};
