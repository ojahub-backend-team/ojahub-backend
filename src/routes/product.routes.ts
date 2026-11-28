import { Router } from "express";
import {
  createProductController,
  getProductsController,
  getProductByIdController,
  updateProductController,
  uploadProductImageController,
  deleteProductImageController,
  deleteProductController,
} from "../controllers/product.controller.js";
import {
  requireBusiness,
  verifySession,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import uploadProductImage from "../config/multer.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validators/product.validator.js";

const router = Router();

// Create a product for the authenticated business.
router.post(
  "/",
  verifySession,
  requireBusiness,
  validate(createProductSchema),
  createProductController,
);

// Retrieve all products belonging to the authenticated business.
router.get("/", verifySession, requireBusiness, getProductsController);

// Retrieve one product by its ID.
router.get(
  "/:productId",
  verifySession,
  requireBusiness,
  getProductByIdController,
);

// Update a product belonging to the authenticated business.
router.put(
  "/:productId",
  verifySession,
  requireBusiness,
  validate(updateProductSchema),
  updateProductController,
);

// Upload or replace a product image.
router.post(
  "/:productId/image",
  verifySession,
  requireBusiness,
  uploadProductImage.single("image"),
  uploadProductImageController,
);

// Delete a product image.
router.delete(
  "/:productId/image",
  verifySession,
  requireBusiness,
  deleteProductImageController,
);

// Delete a product and its associated image.
router.delete(
  "/:productId",
  verifySession,
  requireBusiness,
  deleteProductController,
);

export default router;

// Product endpoints:
//
// POST   /api/products
// Create a product
//
// GET    /api/products
// Retrieve products
//
// GET    /api/products?search=Ankara
// Search products
//
// GET    /api/products?page=2&limit=20
// Retrieve page 2
//
// GET    /api/products/:productId
// Retrieve one product
//
// PUT    /api/products/:productId
// Update a product
//
// POST   /api/products/:productId/image
// Upload or replace a product image
//
// DELETE /api/products/:productId/image
// Delete a product image
//
// DELETE /api/products/:productId
// Delete a product and its image
