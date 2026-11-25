import { Router } from "express";
import {
  requireBusiness,
  verifySession,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createStockTransferController,
  dispatchStockTransferController,
  receiveStockTransferController,
} from "../controllers/stockTransfer.controller.js";
import { createStockTransferSchema } from "../validators/stockTransfer.validator.js";

const router = Router();
router.use(verifySession, requireBusiness);
router.post("/", validate(createStockTransferSchema), createStockTransferController);
router.post("/:transferId/dispatch", dispatchStockTransferController);
router.post("/:transferId/receive", receiveStockTransferController);

export default router;
