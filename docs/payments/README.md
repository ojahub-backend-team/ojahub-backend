# OjaHub Payment Integration

## Overview

OjaHub uses Paystack to process subscription payments.

The backend handles payment initialization, transaction verification, webhook processing, and subscription activation.

Payment confirmation is handled by both the verification endpoint and Paystack webhook. Both use the same payment-processing function to ensure consistent results and prevent duplicate subscription activation.

## Subscription Plans

| Plan       |  Amount |  Duration |
| ---------- | ------: | --------: |
| Monthly    |  ₦5,000 |   1 month |
| Six months | ₦27,000 |  6 months |
| Yearly     | ₦48,000 | 12 months |
| Free trial |    Free |    7 days |

Paystack receives payment amounts in kobo.

## Environment Variables

Configure the following variable in the backend environment:

```env
PAYSTACK_SECRET_KEY=
```

`PAYSTACK_SECRET_KEY` is used for authenticated Paystack API requests and webhook signature verification.

Do not expose this key in frontend code or commit real credentials to GitHub.

## Payment Flow

### 1. Initialize Payment

**Endpoint**

`POST /api/payment/initialize`

**Authentication:** Required.

**Request body**

```json
{
  "plan": "monthly"
}
```

Supported plan values:

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

The customer is redirected to the authorization URL to complete payment.

Payment initialization is rate-limited to 10 requests per 15 minutes per IP address.

### 2. Verify Payment

**Endpoint**

`POST /api/payment/verify/:reference`

**Authentication:** Required.

The backend:

1. Confirms that the payment belongs to the authenticated customer.
2. Retrieves the transaction details from Paystack.
3. Validates the payment reference, amount, currency, and status.
4. Atomically changes the payment status from pending to success.
5. Activates or updates the business subscription.
6. Updates onboarding progress.
7. Sends the payment confirmation email without blocking the response.

A payment that has already been successfully processed is not activated again.

### 3. Paystack Webhook

**Endpoint**

`POST /api/payment/webhook`

**Authentication:** Paystack signature verification.

Configure this endpoint in the Paystack Dashboard as the webhook URL:

`https://YOUR-BACKEND-DOMAIN/api/payment/webhook`

The webhook:

1. Receives the original raw request body.
2. Verifies the `x-paystack-signature` header using HMAC SHA-512.
3. Rejects invalid signatures with HTTP 401 before accessing payment records.
4. Parses the event after signature verification.
5. Processes successful `charge.success` events.
6. Uses the same payment-processing function as the verification endpoint.
7. Returns HTTP 200 after successful processing.

Other event types are acknowledged and ignored.

The webhook is mounted before `express.json()` so the original request body remains available for signature verification.

## Payment Statuses

| Status    | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| `pending` | Payment has been initialized but not confirmed.              |
| `success` | Payment has been successfully verified and processed.        |
| `failed`  | Paystack verification confirmed that the transaction failed. |

## Duplicate Payment Protection

Payment processing uses an atomic pending-to-success update.

This prevents the verification endpoint and webhook from activating the same payment twice.

The success email is sent only when the payment is successfully claimed for processing.

## Email Notifications

Customers receive payment-related email notifications.

Email delivery is handled asynchronously so that email-provider delays do not block payment processing.

The customer's name and other dynamic values are escaped before being inserted into HTML email templates.

## Important Security Considerations

- Never expose `PAYSTACK_SECRET_KEY`.
- Never trust frontend payment-success messages without backend verification.
- Always verify webhook signatures against the original raw request body.
- Validate transaction reference, amount, currency, and payment status.
- Keep payment processing idempotent.
- Do not activate subscriptions based solely on a payment redirect.

## Testing Checklist

- [ ] Initialize a payment using a valid subscription plan.
- [ ] Confirm that a pending payment record is created.
- [ ] Confirm that Paystack returns an authorization URL.
- [ ] Verify a successful transaction.
- [ ] Confirm that the subscription is activated.
- [ ] Confirm that onboarding progress is updated.
- [ ] Confirm that a payment confirmation email is sent.
- [ ] Send an invalid webhook signature and confirm HTTP 401.
- [ ] Send a valid `charge.success` webhook.
- [ ] Confirm that duplicate webhook events do not activate the subscription twice.
- [ ] Confirm that failed transactions do not activate subscriptions.
