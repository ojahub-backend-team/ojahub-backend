# OjaHub Payment Integration

## Overview

OjaHub uses Paystack to process subscription payments.

The backend handles payment initialization, transaction verification, webhook processing, and subscription activation.

Payment confirmation is handled through both the frontend callback verification flow and Paystack webhooks. Both use the same payment-processing function to ensure consistent results and prevent duplicate subscription activation.

## Subscription Plans

| Plan | Amount | Duration |
|---|---:|---:|
| Monthly | ₦5,000 | 1 month |
| Six months | ₦27,000 | 6 months |
| Yearly | ₦48,000 | 12 months |
| Free trial | Free | 7 days |

Paystack receives payment amounts in kobo.

## Environment Variables

Configure the following variables in the backend environment:

```env
PAYSTACK_SECRET_KEY=
CLIENT_URL=
```

- `PAYSTACK_SECRET_KEY` is used for authenticated Paystack API requests and webhook signature verification.
- `CLIENT_URL` is the frontend application URL used to construct the Paystack callback URL.

Never expose these credentials or commit real values to GitHub.

## Payment Flow

### 1. Initialize Payment

**Endpoint:** `POST /api/payment/initialize`

**Authentication:** Required.

**Request body:**

```json
{
  "plan": "monthly"
}
```

Supported paid plan values:

- `monthly`
- `six_months`
- `yearly`

The backend:

1. Authenticates the customer.
2. Confirms that the customer has a business.
3. Validates the requested plan.
4. Checks the customer's subscription and existing pending payments.
5. Creates a pending payment record.
6. Initializes the transaction with Paystack.
7. Returns the Paystack authorization URL.

The frontend redirects the customer to the authorization URL to complete payment.

### 2. Payment Callback

**Frontend callback URL:**

```text
${CLIENT_URL}/payment/callback
```

After the customer completes or leaves the Paystack checkout, Paystack redirects the browser to the configured callback URL.

The callback page should:

1. Read the transaction reference returned in the callback URL.
2. Send the reference to the backend verification endpoint.
3. Display an appropriate result based on the backend response.
4. Redirect the customer to the dashboard after successful verification.

**Important:** The callback page must not activate a subscription or assume payment succeeded simply because the customer was redirected back from Paystack. The backend must verify the transaction directly with Paystack.

### 3. Verify Payment

**Endpoint:** `POST /api/payment/verify/:reference`

**Authentication:** Required.

The backend:

1. Confirms that the payment belongs to the authenticated customer.
2. Retrieves the transaction details from Paystack.
3. Validates the payment reference, amount, currency, and status.
4. Processes the payment atomically.
5. Activates or updates the business subscription when eligible.
6. Updates onboarding progress.
7. Sends the payment confirmation email without blocking the response.

A payment that has already been successfully processed is not activated again.

### 4. Paystack Webhook

**Endpoint:** `POST /api/payment/webhook`

**Authentication:** Paystack signature verification.

Configure this endpoint in the Paystack Dashboard as the webhook URL:

```text
https://YOUR-BACKEND-DOMAIN/api/payment/webhook
```

The webhook:

1. Receives the original raw request body.
2. Verifies the `x-paystack