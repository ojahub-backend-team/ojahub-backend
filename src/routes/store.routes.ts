import { Router } from "express";
import {
  createStoreController,
  getStoresController,
  getStoreByIdController,
  updateStoreController,
} from "../controllers/store.controller.js";
import {
  requireBusiness,
  verifySession,
} from "../middlewares/auth.middleware.js";

// Creates the store management router backed by ZIP 2 Location records.
const router = Router();

// Requires an authenticated user with a business.
router.use(verifySession, requireBusiness);

// Creates a store location.
router.post("/", createStoreController);

// Lists stores belonging to the business.
router.get("/", getStoresController);

// Retrieves one store location.
router.get("/:storeId", getStoreByIdController);

// Updates a store location.
router.patch("/:storeId", updateStoreController);

export default router;
