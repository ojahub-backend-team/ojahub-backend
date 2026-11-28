import { Router } from "express";
import {
  addStockController,
  adjustStockController,
  updateStockThresholdController,
  getStockController,
} from "../controllers/stock.controller.js";
import { verifySession } from "../middlewares/auth.middleware.js";

// Creates the router for stock management endpoints.
const stockRouter = Router();

// Requires authentication for all stock management endpoints.
stockRouter.use(verifySession);

// Adds stock to a product in a selected store.
stockRouter.post("/", addStockController);

// Adjusts the quantity of existing stock.
stockRouter.patch("/adjust", adjustStockController);

// Updates the stock thresholds for a product in a selected store.
stockRouter.patch("/threshold", updateStockThresholdController);

// Retrieves stock records with optional filters and pagination.
stockRouter.get("/", getStockController);

// Exports the stock router for registration in the main application.
export default stockRouter;
