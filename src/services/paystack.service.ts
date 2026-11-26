import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../config/keys.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Verifies the authenticity of a Paystack webhook request.
 *
 * Paystack signs webhook requests using HMAC SHA-512.
 * The signature must be calculated from the original raw request body.
 */

export const verifyPaystackWebhookSignature = (
  rawBody: Buffer,
  signature: string | undefined,
): boolean => {
  if (
    !signature ||
    !Buffer.isBuffer(rawBody) ||
    !/^[a-f0-9]{128}$/i.test(signature)
  ) {
    return false;
  }

  const expectedSignature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  const receivedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
};

/**
 * Standard structure returned by Paystack's API.
 */
interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

/**
 * Data returned when a transaction is initialized.
 */
export interface PaystackInitializationData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * Data returned when a transaction is verified.
 */
export interface PaystackVerificationData {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  channel: string;
}

/**
 * Custom error for Paystack API failures.
 */
export class PaystackServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackServiceError";
  }
}

/**
 * Reusable HTTP client for communicating with Paystack.
 * Keeps authentication, request handling and error handling
 * in one place.
 */
const paystackRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new PaystackServiceError(
        "Paystack request timed out. Please try again.",
      );
    }

    throw new PaystackServiceError("Unable to communicate with Paystack.");
  }

  let result: PaystackApiResponse<T>;

  try {
    result = (await response.json()) as PaystackApiResponse<T>;
  } catch {
    throw new PaystackServiceError("Paystack returned an invalid response.");
  }

  if (!response.ok || !result.status) {
    throw new PaystackServiceError(
      result.message || "Paystack transaction request failed.",
    );
  }

  return result.data;
};

/**
 * Initializes a payment transaction with Paystack.
 *
 * Amount must be supplied in kobo.
 */
export const initializePaystackTransaction = async (
  email: string,
  amountKobo: number,
  reference: string,
): Promise<PaystackInitializationData> => {
  if (!email.trim()) {
    throw new PaystackServiceError("Customer email is required.");
  }

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new PaystackServiceError("A valid transaction amount is required.");
  }

  if (!reference.trim()) {
    throw new PaystackServiceError("Transaction reference is required.");
  }

  return paystackRequest<PaystackInitializationData>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        currency: "NGN",

      }),
    },
  );
};

/**
 * Verifies a transaction using its Paystack reference.
 *
 * This retrieves the transaction details from Paystack.
 * The calling service must still validate the amount,
 * currency, reference and successful payment status.
 */
export const verifyPaystackTransaction = async (
  reference: string,
): Promise<PaystackVerificationData> => {
  if (!reference.trim()) {
    throw new PaystackServiceError("Transaction reference is required.");
  }

  return paystackRequest<PaystackVerificationData>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
    },
  );
};
