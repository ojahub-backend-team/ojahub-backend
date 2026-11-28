import type { Request } from "express";
import tryCatchFn from "../libs/tryCatchFn.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../libs/response-handlers.js";
import {
  createProductService,
  getProductsService,
  getProductByIdService,
  updateProductService,
  deleteProductService,
} from "../services/product-management.service.js";
import {
  uploadProductImageService,
  deleteProductImageService,
} from "../services/product-image.service.js";
import { getProductsSchema } from "../validators/product.validator.js";
import cloudinary from "../config/cloudinary.js";

// Defines the authenticated request structure used by product controllers.
type AuthenticatedRequest = Request & {
  user: {
    _id: string;
    businessId: string;
  };
};

// Defines the uploaded product image file type from the image service.
type UploadedProductImage = Parameters<typeof uploadProductImageService>[2];

// Creates a new product for the authenticated user's business.
export const createProductController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Creates the product through the product service.
  const result = await createProductService(req.body, businessId);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the newly created product.
  return sendSuccessResponse(res, 201, {
    success: true,
    message: result.message,
    body: {
      product: result.product,
    },
  });
});

// Retrieves all products belonging to the authenticated user's business.
export const getProductsController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Validates the search and pagination query parameters.
  const validation = getProductsSchema.safeParse(req.query);

  if (!validation.success) {
    return sendErrorResponse(
      res,
      400,
      "Invalid product query parameters",
      validation.error.flatten().fieldErrors,
    );
  }

  const { search, category, page, limit } = validation.data;

  // Retrieves the filtered and paginated products.
  const result = await getProductsService(businessId, {
    search,
    category,
    page,
    limit,
  });

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the products and their pagination information.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Products retrieved successfully",
    body: {
      products: result.products,
      pagination: result.pagination,
    },
  });
});

// Retrieves one product belonging to the authenticated user's business.
export const getProductByIdController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Extracts the product ID from the route parameters.
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  // Retrieves the requested product through the product service.
  const result = await getProductByIdService(productId, businessId);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the requested product.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: "Product retrieved successfully",
    body: {
      product: result.product,
    },
  });
});

// Updates a product belonging to the authenticated user's business.
export const updateProductController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Extracts the product ID from the route parameters.
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  // Updates the product through the product service.
  const result = await updateProductService(productId, businessId, req.body);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the updated product.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      product: result.product,
    },
  });
});

// Uploads or replaces a product image.
export const uploadProductImageController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Extracts the product ID from the route parameters.
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  // Retrieves the uploaded image from the Multer request.
  const file = (req as Request & { file?: UploadedProductImage }).file;

  // Stops if no image was uploaded.
  if (!file) {
    return sendErrorResponse(res, 400, "Please select a product image");
  }

  // Uploads the image through the product image service.
  const result = await uploadProductImageService(productId, businessId, file);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the uploaded image and any cleanup warning.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {
      image: result.image,
      ...(result.cleanupWarning
        ? { cleanupWarning: result.cleanupWarning }
        : {}),
    },
  });
});

// Deletes a product image.
export const deleteProductImageController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Extracts the product ID from the route parameters.
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  // Deletes the image through the product image service.
  const result = await deleteProductImageService(productId, businessId);

  if (!result.success) {
    return sendErrorResponse(res, result.status, result.message);
  }

  // Returns the deletion result and any cleanup warning.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {},
    ...(result.cleanupWarning ? { cleanupWarning: result.cleanupWarning } : {}),
  });
});

// Deletes a product and its associated Cloudinary image, if one exists.
export const deleteProductController = tryCatchFn(async (req, res) => {
  // Retrieves the authenticated user's business ID.
  const businessId = (req as AuthenticatedRequest).user.businessId;

  // Extracts the product ID from the route parameters.
  const productId = Array.isArray(req.params.productId)
    ? req.params.productId[0]
    : req.params.productId;

  // Finds the product before attempting to delete anything.
  const productResult = await getProductByIdService(productId, businessId);

  if (!productResult.success) {
    return sendErrorResponse(res, productResult.status, productResult.message);
  }

  // Retrieves the Cloudinary public ID, if the product has an image.
  const imagePublicId = productResult.product.image?.publicId;

  // Deletes the image from Cloudinary before deleting the product.
  if (imagePublicId) {
    try {
      const deleteResult = await cloudinary.uploader.destroy(imagePublicId);

      // Stops if Cloudinary did not confirm deletion.
      if (deleteResult.result !== "ok" && deleteResult.result !== "not found") {
        return sendErrorResponse(
          res,
          500,
          "Could not delete the product image from Cloudinary. The product was not deleted.",
        );
      }
    } catch {
      // Keeps the product in MongoDB if Cloudinary deletion fails.
      return sendErrorResponse(
        res,
        500,
        "Could not delete the product image from Cloudinary. The product was not deleted.",
      );
    }
  }

  // Deletes the product from MongoDB after image deletion succeeds.
  const result = await deleteProductService(productId, businessId);

  if (!result.success) {
    return sendErrorResponse(
      res,
      result.status,
      imagePublicId
        ? "The image was deleted, but the product could not be deleted. You may need to upload the image again."
        : result.message,
    );
  }

  // Confirms that the product was deleted.
  return sendSuccessResponse(res, 200, {
    success: true,
    message: result.message,
    body: {},
  });
});
