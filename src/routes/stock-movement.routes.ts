import { Router } from "express";
import { getStockMovementsController } from "../controllers/stock-movement.controller.js";
import { verifySession } from "../middlewares/auth.middleware.js";

// Creates the router for stock movement history endpoints.
const stockMovementRouter = Router();

// Requires authentication for all stock movement endpoints.
stockMovementRouter.use(verifySession);

// Retrieves stock movement history with optional filters and pagination.
stockMovementRouter.get("/", getStockMovementsController);

// Exports the stock movement router for registration in the main application.
export default stockMovementRouter;
