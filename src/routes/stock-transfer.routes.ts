import { Router } from "express";
import {
  createStockTransferController,
  getStockTransfersController,
} from "../controllers/stock-transfer.controller.js";
import { verifySession } from "../middlewares/auth.middleware.js";

// Creates the router for stock transfer endpoints.
const stockTransferRouter = Router();

// Requires authentication for all stock transfer endpoints.
stockTransferRouter.use(verifySession);

// Transfers stock between two stores belonging to the same business.
stockTransferRouter.post("/", createStockTransferController);

// Retrieves stock transfer history with optional filters and pagination.
stockTransferRouter.get("/", getStockTransfersController);

// Exports the stock transfer router for registration in the main application.
export default stockTransferRouter;
