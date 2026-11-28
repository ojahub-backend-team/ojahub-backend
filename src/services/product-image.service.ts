import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import ProductModel from "../models/product.model.js";

// Type for an uploaded image using Multer memory storage.
type MulterFile = {
  buffer: Buffer;
};

// Possible errors returned by an image service.
type ImageServiceError = {
  success: false;
  status: number;
  message: string;
};

// Convert a business ID string to a MongoDB ObjectId.
const getBusinessObjectId = (
  businessId: string,
): mongoose.Types.ObjectId | null => {
  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    return null;
  }

  return new mongoose.Types.ObjectId(businessId);
};

// Upload an image buffer directly to Cloudinary.
const uploadToCloudinary = async (
  file: MulterFile,
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    // Open a Cloudinary upload stream.
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "ojahub/products",
        resource_type: "image",
      },
      (error, result) => {
        // Handle an unsuccessful upload.
        if (error || !result) {
          reject(error ?? new Error("Image upload failed"));
          return;
        }

        // Return the image URL and Cloudinary public ID.
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    // Send the image buffer to Cloudinary.
    uploadStream.end(file.buffer);
  });
};

// Result returned when uploading or replacing a product image.
type UploadProductImageResult =
  | {
      success: true;
      image: {
        url: string;
        publicId: string;
      };
      message: string;
      cleanupWarning?: string;
    }
  | ImageServiceError;

// Upload a new image or replace an existing product image.
export const uploadProductImageService = async (
  productId: string,
  businessId: string,
  file: MulterFile,
): Promise<UploadProductImageResult> => {
  // Validate the product ID.
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID",
    };
  }

  // Convert the business ID string to an ObjectId.
  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  // Check that a file was provided.
  if (!file) {
    return {
      success: false,
      status: 400,
      message: "Please select a product image",
    };
  }

  // Confirm that the product belongs to this business.
  const existingProduct = await ProductModel.findOne({
    _id: productId,
    businessId: businessObjectId,
  }).lean();

  if (!existingProduct) {
    return {
      success: false,
      status: 404,
      message: "Product not found",
    };
  }

  // Upload the new image to Cloudinary.
  const uploadedImage = await uploadToCloudinary(file);

  // Save the new image details in MongoDB.
  let updatedProduct;

  try {
    updatedProduct = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        businessId: businessObjectId,
      },
      {
        $set: {
          image: uploadedImage,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();
  } catch (error) {
    // If MongoDB throws an error, remove the newly uploaded image.
    await cloudinary.uploader.destroy(uploadedImage.publicId).catch(() => null);

    // Pass the error to the controller's error handler.
    throw error;
  }

  // If MongoDB update fails, remove the newly uploaded image.
  if (!updatedProduct) {
    await cloudinary.uploader.destroy(uploadedImage.publicId).catch(() => null);

    return {
      success: false,
      status: 500,
      message: "Could not save the product image",
    };
  }

  // After saving the new image, remove the previous image.
  // This also handles image replacement.
  let cleanupWarning: string | undefined;

  if (
    existingProduct.image?.publicId &&
    existingProduct.image.publicId !== uploadedImage.publicId
  ) {
    try {
      const deleteResult = await cloudinary.uploader.destroy(
        existingProduct.image.publicId,
      );

      if (deleteResult.result !== "ok" && deleteResult.result !== "not found") {
        cleanupWarning =
          "The previous image could not be removed from Cloudinary";
      }
    } catch {
      cleanupWarning =
        "The previous image could not be removed from Cloudinary";
    }
  }

  return {
    success: true,
    image: uploadedImage,
    message: "Product image uploaded successfully",
    ...(cleanupWarning ? { cleanupWarning } : {}),
  };
};

// Result returned when deleting a product image.
type DeleteProductImageResult =
  | {
      success: true;
      message: string;
      cleanupWarning?: string;
    }
  | ImageServiceError;

// Remove a product image from MongoDB and Cloudinary.
export const deleteProductImageService = async (
  productId: string,
  businessId: string,
): Promise<DeleteProductImageResult> => {
  // Validate the product ID.
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return {
      success: false,
      status: 400,
      message: "Invalid product ID",
    };
  }

  // Convert the business ID string to an ObjectId.
  const businessObjectId = getBusinessObjectId(businessId);

  if (!businessObjectId) {
    return {
      success: false,
      status: 400,
      message: "Invalid business ID",
    };
  }

  // Find the product belonging to this business.
  const existingProduct = await ProductModel.findOne({
    _id: productId,
    businessId: businessObjectId,
  }).lean();

  if (!existingProduct) {
    return {
      success: false,
      status: 404,
      message: "Product not found",
    };
  }

  // Check whether the product currently has an image.
  if (!existingProduct.image?.publicId) {
    return {
      success: false,
      status: 404,
      message: "This product does not have an image",
    };
  }

  // Delete the actual image from Cloudinary first.
  try {
    const deleteResult = await cloudinary.uploader.destroy(
      existingProduct.image.publicId,
    );

    // Cloudinary returns "not found" if the image is already deleted.
    if (deleteResult.result !== "ok" && deleteResult.result !== "not found") {
      return {
        success: false,
        status: 500,
        message: "Could not delete the product image from Cloudinary",
      };
    }
  } catch {
    // Keep the image information in MongoDB if Cloudinary fails.
    return {
      success: false,
      status: 500,
      message: "Could not delete the product image from Cloudinary",
    };
  }

  // Cloudinary deletion succeeded. Now remove the image reference from MongoDB.
  const updatedProduct = await ProductModel.findOneAndUpdate(
    {
      _id: productId,
      businessId: businessObjectId,
      "image.publicId": existingProduct.image.publicId,
    },
    {
      $set: {
        image: null,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // Report an error if MongoDB could not be updated.
  if (!updatedProduct) {
    return {
      success: false,
      status: 500,
      message:
        "The image was deleted from Cloudinary, but its reference could not be removed from the product",
    };
  }

  return {
    success: true,
    message: "Product image deleted successfully",
  };
};
