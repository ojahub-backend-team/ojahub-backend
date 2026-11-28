import mongoose from "mongoose";
import ProductModel, { type IProduct } from "../models/product.model.js";
import PriceProfileModel, {
  type PricingProfileCode,
} from "../models/price-profile.model.js";

// Data required when creating a product.
type CreateProductData = {
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  unit: string;
  prices: {
    priceProfileId: string;
    minQuantity?: number;
    maxQuantity?: number | null;
    discountPercentage: number;
    priceKobo: number;
  }[];
};

// Plain product data returned by product queries.
type ProductRecord = Pick<
  IProduct,
  | "_id"
  | "businessId"
  | "name"
  | "description"
  | "category"
  | "sku"
  | "unit"
  | "prices"
  | "image"
  | "createdAt"
  | "updatedAt"
>;

// Possible errors returned by a service.
type ServiceError = {
  success: false;
  status: number;
  message: string;
};

// Result returned when creating a product.
type CreateProductResult =
  | {
      success: true;
      product: ProductRecord;
      message: string;
    }
  | ServiceError;

// Prepared pricing tier saved to the product.
type PreparedProductPrice = {
  priceProfileId: mongoose.Types.ObjectId;
  minQuantity: number;
  maxQuantity: number | null;
  discountPercentage: number;
  priceKobo: number;
};

// Describes the selected fields returned by the price profile query.
type ValidPriceProfile = {
  _id: mongoose.Types.ObjectId;
  code: PricingProfileCode;
};

// Validates a business ID and converts it into a MongoDB ObjectId.
const getBusinessObjectId = (
  businessId: string,
): mongoose.Types.ObjectId | null => {
  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    return null;
  }

  return new mongoose.Types.ObjectId(businessId);
};

// Validate and prepare a product's pricing tiers.
// Apply default quantity ranges based on each price profile's code.
const validateProductPrices = async (
  prices: CreateProductData["prices"],
  businessId: mongoose.Types.ObjectId,
): Promise<
  | {
      success: true;
      prices: PreparedProductPrice[];
    }
  | ServiceError
> => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return {
      success: false,
      status: 400,
      message: "At least one product price profile is required",
    };
  }

  // Prepare profile IDs and validate individual pricing values.
  const formattedPrices: {
    priceProfileId: mongoose.Types.ObjectId;
    minQuantity?: number;
    maxQuantity?: number | null;
    discountPercentage: number;
    priceKobo: number;
  }[] = [];

  for (const price of prices) {
    if (!mongoose.Types.ObjectId.isValid(price.priceProfileId)) {
      return {
        success: false,
        status: 400,
        message: "Invalid price profile ID",
      };
    }

    if (
      price.minQuantity !== undefined &&
      (!Number.isInteger(price.minQuantity) || price.minQuantity < 1)
    ) {
      return {
        success: false,
        status: 400,
        message: "Minimum quantity must be a positive whole number",
      };
    }

    if (
      price.maxQuantity !== undefined &&
      price.maxQuantity !== null &&
      (!Number.isInteger(price.maxQuantity) || price.maxQuantity < 1)
    ) {
      return {
        success: false,
        status: 400,
        message: "Maximum quantity must be a positive whole number",
      };
    }

    if (
      !Number.isFinite(price.discountPercentage) ||
      price.discountPercentage < 0 ||
      price.discountPercentage > 100
    ) {
      return {
        success: false,
        status: 400,
        message: "Discount percentage must be between 0 and 100",
      };
    }

    if (!Number.isSafeInteger(price.priceKobo) || price.priceKobo < 0) {
      return {
        success: false,
        status: 400,
        message: "Selling price must be a non-negative whole number in kobo",
      };
    }

    formattedPrices.push({
      priceProfileId: new mongoose.Types.ObjectId(price.priceProfileId),
      minQuantity: price.minQuantity,
      maxQuantity: price.maxQuantity,
      discountPercentage: price.discountPercentage,
      priceKobo: price.priceKobo,
    });
  }

  // A product must not contain the same price profile more than once.
  const profileIds = formattedPrices.map((price) =>
    price.priceProfileId.toString(),
  );

  if (new Set(profileIds).size !== profileIds.length) {
    return {
      success: false,
      status: 400,
      message: "A product cannot have duplicate price profile entries",
    };
  }

  // Confirm that every profile exists and belongs to this business.
  const validProfiles: ValidPriceProfile[] = await PriceProfileModel.find({
    _id: { $in: formattedPrices.map((price) => price.priceProfileId) },
    businessId,
  })
    .select("_id code")
    .lean();

  if (validProfiles.length !== formattedPrices.length) {
    return {
      success: false,
      status: 400,
      message: "One or more price profiles do not belong to this business",
    };
  }

  // Map each profile ID to its strongly typed profile code.
  const profileCodes = new Map<string, PricingProfileCode>(
    validProfiles.map((profile): [string, PricingProfileCode] => [
      profile._id.toString(),
      profile.code,
    ]),
  );

  // Define default quantity ranges for standard profiles.
  const defaultRanges: Record<
    PricingProfileCode,
    { minQuantity: number; maxQuantity: number | null }
  > = {
    retail: {
      minQuantity: 1,
      maxQuantity: 6,
    },
    semi_wholesale: {
      minQuantity: 7,
      maxQuantity: 19,
    },
    bulk_importer: {
      minQuantity: 20,
      maxQuantity: null,
    },
  };

  // Apply default ranges while preserving trader-supplied values.
  const preparedPrices: PreparedProductPrice[] = [];

  for (const price of formattedPrices) {
    // Retrieve the typed profile code for the current price.
    const profileCode: PricingProfileCode | undefined = profileCodes.get(
      price.priceProfileId.toString(),
    );

    // Retrieve the default quantity range for the profile.
    const defaultRange = profileCode ? defaultRanges[profileCode] : undefined;

    if (
      (price.minQuantity === undefined || price.maxQuantity === undefined) &&
      !defaultRange
    ) {
      return {
        success: false,
        status: 400,
        message: "Custom price profiles require quantity ranges",
      };
    }

    const minQuantity = price.minQuantity ?? defaultRange?.minQuantity;

    const maxQuantity =
      price.maxQuantity === undefined
        ? defaultRange?.maxQuantity
        : price.maxQuantity;

    if (
      minQuantity === undefined ||
      maxQuantity === undefined ||
      (maxQuantity !== null && maxQuantity < minQuantity)
    ) {
      return {
        success: false,
        status: 400,
        message: "Invalid product quantity range",
      };
    }

    preparedPrices.push({
      priceProfileId: price.priceProfileId,
      minQuantity,
      maxQuantity,
      discountPercentage: price.discountPercentage,
      priceKobo: price.priceKobo,
    });
  }

  // Sort tiers by their minimum quantity to check their coverage.
  const sortedPrices = [...preparedPrices].sort(
    (a, b) => a.minQuantity - b.minQuantity,
  );

  // Quantity coverage must begin at 1.
  if (sortedPrices[0].minQuantity !== 1) {
    return {
      success: false,
      status: 400,
      message: "Product quantity pricing must start at quantity 1",
    };
  }

  // Prevent overlapping ranges and gaps.
  for (let i = 0; i < sortedPrices.length - 1; i++) {
    const current = sortedPrices[i];
    const next = sortedPrices[i + 1];

    if (
      current.maxQuantity === null ||
      current.maxQuantity >= next.minQuantity
    ) {
      return {
        success: false,
        status: 400,
        message: "Product quantity price ranges must not overlap",
      };
    }

    if (current.maxQuantity + 1 !== next.minQuantity) {
      return {
        success: false,
        status: 400,
        message: "Product quantity price ranges must not have gaps",
      };
    }
  }

  // The final tier must cover all quantities above its minimum.
  if (sortedPrices[sortedPrices.length - 1].maxQuantity !== null) {
    return {
      success: false,
      status: 400,
      message: "The final quantity price tier must have no maximum quantity",
    };
  }

  return {
    success: true,
    prices: preparedPrices,
  };
};

// Create a new product for a business.
export const createProductService = async (
  formData: CreateProductData,
  businessId: string,
): Promise<CreateProductResult> => {
  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  const { name, description, category, sku, unit, prices } = formData;

  // Validate all product pricing tiers and their business ownership.
  const priceValidation = await validateProductPrices(prices, businessObjectId);

  if (!priceValidation.success) {
    return priceValidation;
  }

  // Check whether another product in this business already uses this SKU.
  if (sku) {
    const existingProduct = await ProductModel.findOne({
      businessId: businessObjectId,
      sku,
    }).lean();

    if (existingProduct) {
      return {
        success: false,
        status: 409,
        message: "A product with this SKU already exists",
      };
    }
  }

  // Save the product without an image.
  const newProduct = await ProductModel.create({
    businessId: businessObjectId,
    name,
    description,
    category,
    sku,
    unit,
    prices: priceValidation.prices,
    image: null,
  });

  return {
    success: true,
    product: newProduct,
    message: "Product created successfully",
  };
};

// Options for retrieving products.
type GetProductsOptions = {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
};

// Result returned when retrieving products.
type GetProductsResult =
  | {
      success: true;
      products: ProductRecord[];
      pagination: {
        totalProducts: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
      };
    }
  | ServiceError;

// Retrieve all products belonging to one business.
export const getProductsService = async (
  businessId: string,
  options: GetProductsOptions,
): Promise<GetProductsResult> => {
  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    businessId: businessObjectId,
  };

  if (options.category) {
    filter.category = options.category;
  }

  if (options.search?.trim()) {
    const escapedSearch = options.search
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { sku: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const [products, totalProducts] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    ProductModel.countDocuments(filter),
  ]);

  return {
    success: true,
    products,
    pagination: {
      totalProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      pageSize: limit,
    },
  };
};

// Result returned when retrieving one product.
type GetProductByIdResult =
  | {
      success: true;
      product: ProductRecord;
    }
  | ServiceError;

// Retrieve one product belonging to a specific business.
export const getProductByIdService = async (
  productId: string,
  businessId: string,
): Promise<GetProductByIdResult> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID",
    };
  }

  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  const product = await ProductModel.findOne({
    _id: new mongoose.Types.ObjectId(productId),
    businessId: businessObjectId,
  }).lean();

  if (!product) {
    return {
      success: false,
      status: 404,
      message: "Product not found",
    };
  }

  return {
    success: true,
    product,
  };
};

// Data allowed when updating a product.
type UpdateProductData = Partial<CreateProductData>;

// Result returned when updating a product.
type UpdateProductResult =
  | {
      success: true;
      product: ProductRecord;
      message: string;
    }
  | ServiceError;

// Update a product belonging to a specific business.
export const updateProductService = async (
  productId: string,
  businessId: string,
  formData: UpdateProductData,
): Promise<UpdateProductResult> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID",
    };
  }

  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  const productObjectId = new mongoose.Types.ObjectId(productId);

  const existingProduct = await ProductModel.findOne({
    _id: productObjectId,
    businessId: businessObjectId,
  }).lean();

  if (!existingProduct) {
    return {
      success: false,
      status: 404,
      message: "Product not found",
    };
  }

  // Check for duplicate SKU if the SKU is being changed.
  if (formData.sku) {
    const duplicateSku = await ProductModel.findOne({
      businessId: businessObjectId,
      sku: formData.sku,
      _id: { $ne: productObjectId },
    }).lean();

    if (duplicateSku) {
      return {
        success: false,
        status: 409,
        message: "A product with this SKU already exists",
      };
    }
  }

  const updateData: Record<string, unknown> = {
    ...formData,
  };

  // Validate and prepare pricing tiers only when prices are included.
  if (formData.prices !== undefined) {
    const priceValidation = await validateProductPrices(
      formData.prices,
      businessObjectId,
    );

    if (!priceValidation.success) {
      return priceValidation;
    }

    updateData.prices = priceValidation.prices;
  }

  const updatedProduct = await ProductModel.findOneAndUpdate(
    {
      _id: productObjectId,
      businessId: businessObjectId,
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    },
  ).lean();

  if (!updatedProduct) {
    return {
      success: false,
      status: 404,
      message: "Product not found",
    };
  }

  return {
    success: true,
    product: updatedProduct,
    message: "Product updated successfully",
  };
};

// Result returned when deleting a product.
type DeleteProductResult =
  | {
      success: true;
      message: string;
      image: {
        url: string;
        publicId: string;
      } | null;
    }
  | ServiceError;

// Delete one product belonging to a specific business.
export const deleteProductService = async (
  productId: string,
  businessId: string,
): Promise<DeleteProductResult> => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID",
    };
  }

  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  const deletedProduct = await ProductModel.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(productId),
    businessId: businessObjectId,
  }).lean();

  if (!deletedProduct) {
    return {
      success: false,
      status: 404,
      message: "Product not found",
    };
  }

  const image = deletedProduct.image ?? null;

  return {
    success: true,
    message: "Product deleted successfully",
    image,
  };
};
