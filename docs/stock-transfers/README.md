# Stock Transfer Implementation and Testing Guide

## 1. Overview

The Stock Transfer feature allows a business to move products between its different shops and warehouses.

For example, a business owner can transfer 20 cartons of a product from their main shop to their central warehouse.

The feature ensures that:
- Stock is deducted from the source location when a transfer is dispatched.
- Stock is added to the destination location when the transfer is received.
- Every stock movement is recorded for inventory tracking.
- A transfer cannot be dispatched or received more than once.
- Businesses can only access their own stock transfers and inventory records.

## 2. Technologies Used

- Node.js
- Express.js 5
- TypeScript
- MongoDB Atlas
- Mongoose
- Zod
- Postman

## 3. How the Feature Was Implemented

The feature was implemented using separate models, validators, services, controllers, and routes to keep the code organised and maintainable.

### A. Database Models

Three existing inventory models were used to support the stock transfer functionality.

**1. Stock Transfer Model (`stockTransfer.model.ts`)**

This model stores information about each transfer.

Important fields include:
- `businessId`: Identifies the business that owns the transfer.
- `sourceLocationId`: The location sending the stock.
- `destinationLocationId`: The location receiving the stock.
- `items`: Products and quantities included in the transfer.
- `status`: Current transfer status.
- `requestedBy`: User who created the transfer.
- `dispatchedBy`: User who dispatched the transfer.
- `receivedBy`: User who confirmed receipt.
- `dispatchedAt`: Dispatch date and time.
- `receivedAt`: Receipt date and time.
- `notes`: Additional information about the transfer.

The transfer has three possible statuses:

- `requested`
- `in_transit`
- `received`

Schema validation ensures that a transfer contains at least one product, quantities are positive whole numbers, and the source and destination locations are different.

**2. Stock Level Model (`stockLevel.model.ts`)**

This model tracks the available quantity of each product at a particular location.

A unique compound index was implemented using:

`businessId`, `productId`, and `locationId`.

This prevents duplicate stock-level records for the same product at the same location within a business.

Quantity validation also ensures that stock cannot be negative or contain decimal values.

**3. Stock Movement Model (`stockMovement.model.ts`)**

This model maintains records of inventory changes.

The movement types include:
- `opening`
- `new_stock`
- `damaged`
- `count_correction`
- `transfer_out`
- `transfer_in`
- `sale`

For stock transfers, two movement records are created:
- `transfer_out`: Records stock deducted from the source location.
- `transfer_in`: Records stock added to the destination location.

Each movement records the product, location, quantity change, balance after the movement, business, and associated user where applicable.

### B. Input Validation

A Zod validator was implemented in `stockTransfer.validator.ts`.

It validates:
- Source and destination location IDs.
- Different source and destination locations.
- At least one product in a transfer.
- Valid product IDs.
- Positive whole-number quantities.
- No duplicate products in the same transfer.
- Notes not exceeding 500 characters.

This prevents invalid transfer requests from reaching the service layer.

### C. Service Layer

The main business logic was implemented in `stockTransfer.service.ts`.

Three main services were created:

**1. Create Stock Transfer**

`createStockTransferService`

This service:
- Confirms that the business exists.
- Checks that the source and destination locations belong to the business and are active.
- Confirms that the selected products belong to the business and are active.
- Creates a transfer with the initial status `requested`.

Stock is not deducted at this stage. Stock availability is checked during dispatch.

**2. Dispatch Stock Transfer**

`dispatchStockTransferService`

This service:
- Finds the transfer using its ID and business ID.
- Confirms that its status is `requested`.
- Checks that the source and destination locations are still active.
- Confirms that the products are active.
- Checks whether sufficient stock is available at the source location.
- Deducts the requested quantities from the source location.
- Creates `transfer_out` stock movement records.
- Updates the transfer status to `in_transit`.
- Records the user who dispatched it and the dispatch timestamp.

Stock deduction is performed conditionally to prevent inventory from becoming negative.

**3. Receive Stock Transfer**

`receiveStockTransferService`

This service:
- Finds the transfer using its ID and business ID.
- Confirms that its status is `in_transit`.
- Confirms that the destination location belongs to the business.
- Adds the transferred quantities to the destination stock levels.
- Creates `transfer_in` stock movement records.
- Updates the transfer status to `received`.
- Records the user who confirmed receipt and the receipt timestamp.

The destination does not have to remain active at receipt time. This allows a transfer that was already dispatched to be received even if the destination location is deactivated afterwards.

### D. MongoDB Transactions

MongoDB transactions were used for both dispatching and receiving transfers.

This ensures that related database operations succeed or fail together.

For example, during dispatch:
- Stock deduction takes place.
- Stock movement records are created.
- Transfer status is updated.

If an operation fails, the transaction is rolled back so that partial updates are not saved.

The same approach is used when receiving stock.

**Note:** MongoDB transactions require a replica set or sharded cluster.

### E. Controllers and Routes

Controllers were implemented in `stockTransfer.controller.ts` to receive requests, call the appropriate services, and return responses.

The routes were implemented in `stockTransfer.routes.ts`.

All stock transfer routes are protected using:
- `verifySession`
- `requireBusiness`

The routes are mounted in `app.ts` under:

`/api/stock-transfers`

## 4. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/stock-transfers` | Create a stock transfer |
| POST | `/api/stock-transfers/:transferId/dispatch` | Dispatch a stock transfer |
| POST | `/api/stock-transfers/:transferId/receive` | Receive a stock transfer |

All endpoints require an authenticated session and an active business context.

The business ID is obtained from the authenticated user's session. It is not accepted from the request body or URL.

## 5. Testing Guide (Postman)

The following procedure explains how to test the stock transfer functionality manually using Postman.

### Prerequisites

Before testing, ensure that:

1. The backend server is running.
2. MongoDB is connected.
3. MongoDB transactions are supported by the database deployment.
4. You have a registered and authenticated account.
5. Your account has completed business onboarding.
6. Your business has at least two active locations.
7. Your business has an active product with an available stock quantity.

For the examples below, assume:

- Base URL: `http://localhost:3800`
- Source location: Main Shop
- Destination location: Central Warehouse
- Product: Indomie Noodles

Create a Postman environment variable:

`baseUrl = http://localhost:3800`

### Test 1: Authenticate

Log in using your registered account.

Use the appropriate login endpoint and credentials.

Ensure Postman retains the session cookie returned by the server.

The session cookie is required for subsequent stock transfer requests.

### Test 2: Create a Stock Transfer

**Method:** POST

**URL:**

`{{baseUrl}}/api/stock-transfers`

**Headers:**

`Content-Type: application/json`

**Request Body:**

```json
{
  "sourceLocationId": "SOURCE_LOCATION_ID",
  "destinationLocationId": "DESTINATION_LOCATION_ID",
  "items": [
    {
      "productId": "PRODUCT_ID",
      "quantity": 3
    }
  ],
  "notes": "Postman stock transfer test"
}
```

Replace the placeholder IDs with actual IDs from your database.

**Expected Result:**

- The request succeeds.
- A new transfer is created.
- The transfer status is `requested`.
- The correct business ID is assigned.
- The selected locations and products are saved.
- Stock quantities remain unchanged.

Copy the transfer ID returned in the response. You will need it for the next tests.

### Test 3: Dispatch the Stock Transfer

**Method:** POST

**URL:**

`{{baseUrl}}/api/stock-transfers/TRANSFER_ID/dispatch`

Replace `TRANSFER_ID` with the ID returned when creating the transfer.

No request body is required.

**Expected Result:**

- The request succeeds.
- Transfer status changes to `in_transit`.
- The dispatching user's ID is recorded.
- The dispatch timestamp is recorded.
- Stock is deducted from the source location.
- A `transfer_out` movement is created.

For example, if the source location had 100 units and 3 units were transferred, the new balance should be 97.

### Test 4: Receive the Stock Transfer

**Method:** POST

**URL:**

`{{baseUrl}}/api/stock-transfers/TRANSFER_ID/receive`

Use the same transfer ID.

No request body is required.

**Expected Result:**

- The request succeeds.
- Transfer status changes to `received`.
- The receiving user's ID is recorded.
- The receipt timestamp is recorded.
- Stock is added to the destination location.
- A `transfer_in` movement is created.

For example, if the destination location previously had 20 units, its new balance should be 23.

### Test 5: Verify Inventory Changes

Open MongoDB Atlas and inspect the `stocklevels` collection.

Check the stock quantities for the source and destination locations.

For a transfer of 3 units:

| Location | Before | After |
|---|---:|---:|
| Main Shop | 100 | 97 |
| Central Warehouse | 20 | 23 |

The figures above are illustrative. Actual balances depend on the quantities in your database before testing.

### Test 6: Verify Stock Movement Records

Open the `stockmovements` collection.

Find the records associated with the transfer.

You should find:

| Movement type | Quantity change | Balance after |
|---|---:|---:|
| transfer_out | -3 | 97 |
| transfer_in | +3 | 23 |

Confirm that both movements reference the correct business, product, and locations.

### Test 7: Attempt Duplicate Dispatch

After a transfer has been dispatched, attempt to dispatch it again.

**Expected Result:**

- The request is rejected.
- A conflict response is returned.
- The transfer remains in its existing status.
- No additional stock is deducted.
- No duplicate movement is created.

### Test 8: Attempt Duplicate Receipt

After a transfer has been received, attempt to receive it again.

**Expected Result:**

- The request is rejected.
- A conflict response is returned.
- Stock is not added again.
- No duplicate movement is created.

### Test 9: Test Insufficient Stock

Create a transfer requesting more stock than is available at the source location.

For example, if the source location has 80 units, request 1,000 units.

Attempt to dispatch the transfer.

**Expected Result:**

- Dispatch is rejected.
- An insufficient stock error is returned.
- Transfer status remains `requested`.
- Source stock remains unchanged.
- No `transfer_out` movement is created.

### Test 10: Test Business ID Protection

Attempt to create a transfer while including a different business ID in the request body.

For example:

```json
{
  "businessId": "000000000000000000000001",
  "sourceLocationId": "SOURCE_LOCATION_ID",
  "destinationLocationId": "DESTINATION_LOCATION_ID",
  "items": [
    {
      "productId": "PRODUCT_ID",
      "quantity": 3
    }
  ]
}
```

**Expected Result:**

The backend should ignore the supplied business ID and use the business ID associated with the authenticated user's session.

The resulting transfer must belong to the authenticated user's business.

## 6. Tests Performed and Results

The following tests were performed using Postman and the same authenticated business account.

| Test | Result |
|---|---|
| Create stock transfer | Passed |
| Dispatch stock transfer | Passed |
| Receive stock transfer | Passed |
| Attempt duplicate dispatch | Passed |
| Attempt duplicate receipt | Passed |
| Insufficient stock validation | Passed |
| Business ID tampering protection | Passed |
| Repeat complete transfer flow | Passed |

The complete transfer flow was successfully repeated after the code review:

`requested → in_transit → received`

A separate cross-business access test and final database index verification remain outstanding.

## 7. Important Implementation Considerations

- Always obtain the business ID from the authenticated user's session.
- Never trust a business ID supplied by the client.
- Always check that products and locations belong to the authenticated business.
- Use MongoDB transactions for operations that modify stock and transfer status together.
- Prevent stock quantities from becoming negative.
- Prevent duplicate product entries in a single transfer request.
- Record every inventory change in the stock movement collection.
- Avoid allowing a transfer to be dispatched or received more than once.
- Preserve stock movement records as an inventory audit trail.

## 8. Conclusion

The Stock Transfer feature was implemented to support the movement of products between business locations while maintaining accurate inventory records.

The implementation uses business-scoped database queries, Zod validation, MongoDB transactions, and stock movement tracking to maintain data consistency and prevent invalid stock operations.

The main transfer workflow was successfully tested using Postman, including creation, dispatch, receipt, duplicate-operation checks, insufficient-stock validation, and business ID protection.