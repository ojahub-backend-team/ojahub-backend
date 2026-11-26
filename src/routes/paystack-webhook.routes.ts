import { Router } from "express";
import type { Request, Response } from "express";
import tryCatchFn from "../libs/tryCatchFn.js";
import {
  PaymentServiceError,
  processPaymentByReference,
} from "../services/payment.service.js";
import { verifyPaystackWebhookSignature } from "../services/paystack.service.js";

const router = Router();

interface PaystackWebhookEvent {
  event?: string;
  data?: {
    reference?: string;
  };
}

router.post(
  "/",
  tryCatchFn(async (req: Request, res: Response) => {
    const signature = req.headers["x-paystack-signature"];

    // 1. Verify the signature using the original raw request body.
    const isValid = verifyPaystackWebhookSignature(
      req.body,
      typeof signature === "string" ? signature : undefined,
    );

    // Reject invalid signatures before accessing the database.
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    // 2. Parse the body only after signature verification.
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook request body.",
      });
    }

    let event: PaystackWebhookEvent;

    try {
      event = JSON.parse(req.body.toString("utf8")) as PaystackWebhookEvent;
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook JSON payload.",
      });
    }

    // 3. Ignore events that are not successful charge notifications.
    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Webhook event received and ignored.",
      });
    }

    const reference = event.data?.reference;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is missing.",
      });
    }

    // 4. Process the payment using the same function as /verify.
    await processPaymentByReference(reference);

    // 5. Acknowledge the webhook after payment processing.
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
    });
  }),
);

export default router;
