# OjaHub Backend

Backend API for **OjaHub**, an inventory, invoicing and payment platform for wholesale traders in Nigerian open markets (Balogun, Alaba, Ariaria and similar).

Customers never create an account: they pay an invoice through a link. Each trader (business) only ever sees its own data.

## Tech stack

- Node.js, Express 5, TypeScript (ES modules)
- MongoDB Atlas with Mongoose
- Session authentication: express-session + connect-mongo (cookie `_ojahub`)
- Zod for request validation
- Nodemailer with Brevo SMTP for email
- Paystack for payments (planned)

## Modules and roadmap

| Sprint  | Scope                                                             |
| ------- | ----------------------------------------------------------------- |
| 1       | Foundation, authentication, onboarding, subscription expiry check |
| 2       | Products, locations, stock, customers                             |
| 3       | Invoices, payments, webhooks                                      |
| 4       | Notifications, offline sync                                       |
| After 3 | Platform admin (separate login, roles, two-step verification)     |

## Getting started

Requirements: Node.js, npm and a MongoDB Atlas database.

```bash
git clone https://github.com/ojahub-backend-team/ojahub-backend.git
cd ojahub-backend
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env`.

Fill in `.env` with your own values (ask the team lead privately for shared ones). Use your own `DB_NAME` so developers do not overwrite each other's data. The API runs at `http://localhost:3800`.

**Never commit `.env`.** It must stay in `.gitignore`. Only `.env.example` (blank placeholders) is tracked.

## Project structure

```text
src/
  config/        environment keys, database, session, logger
  controllers/   request handlers
  libs/          shared helpers (response format, error wrapper)
  middlewares/   auth, validation, rate limiting, errors
  models/        Mongoose models
  routes/        route definitions
  services/      business logic
  types/         TypeScript type extensions
  utils/         small helpers (sessions, OTP, email)
  validators/    Zod schemas
docs/            one folder per module, each with a README.md
```

## Rules for every module

- Every record carries the **business ID**. A business must never read another business's data. Take the business ID from `req.user.businessId`, never from the request body or URL.
- Protected routes use `verifySession`, and routes that touch business data also use `requireBusiness`.
- Money is stored in kobo.
- Permissions are checked on the backend.
- Validate input with a Zod schema and the `validate()` middleware.
- Use "business" and "business ID" in code and docs.

## Team workflow

- Branches: `main`, `develop`, and `feature/<module>-<task>`.
- Open a pull request for every change and get it reviewed before merging.
- Every branch push includes a README at `docs/<module>/README.md` describing the module's routes and how to test them.
- Never commit secrets.

## Module documentation

- Auth and onboarding: `docs/auth/README.md` (routes, flows, test log in `docs/auth/TESTING.md`)

## Added Trader Product and Inventory Modules

The following modules and API routes have been added to support trader product, store and inventory management:

| Module                 | Base route                       | Description                                                                                                                                |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Price Profiles         | `/api/price-profiles`            | Creates and manages business-specific Retail, Semi-wholesale and Bulk Importer pricing profiles.                                           |
| Store Management       | `/api/stores`                    | Creates, retrieves and updates store locations using the existing `Location` model and its `shop` and `warehouse` types.                   |
| Products               | `/api/products`                  | Provides product creation, retrieval, updating and deletion, including product categories, flexible units and price-profile pricing tiers. |
| Product Images         | `/api/products/:productId/image` | Handles product image uploads and deletion separately using Multer and Cloudinary.                                                         |
| Stock Records          | `/api/stocks`                    | Provides an additional stock-record implementation using `locationId` to associate stock with a store location.                            |
| Stock Transfers        | `/api/stock-transfers`           | Handles stock transfers between locations and records the corresponding stock changes at the sending and receiving locations.              |
| Stock Movement History | `/api/stock-movements`           | Provides an additional implementation for tracking inventory movements, including stock activity and transfer-related records.             |

### Inventory Implementation and Team Review

The existing inventory implementation has been preserved. Rather than replacing or merging the existing inventory models, additional implementations have been introduced for the team to review.

The existing `StockLevel` and `StockMovement` models remain intact. New files, including `stockMovement.ts` and `stock-movement-record.ts`, alongside the additional stock-record implementation, provide an alternative approach to managing inventory records and movement history.

The new implementation uses separate models and MongoDB collections:

- `StockRecord` — stores stock quantities associated with products and locations.
- `StockMovementRecord` — records inventory movements and related stock activities.
- `stock_records` — collection for the additional stock records.
- `stock_movement_records` — collection for the additional stock movement records.

The stock-transfer implementation works with these additional records. It records the reduction at the sending location and the corresponding increase at the receiving location, while maintaining movement history.

**The team can review the existing files and the newly created files, compare their structure, responsibilities and data flow, and decide which implementation is best suited to the project.** The team can then choose which approach to retain, modify, combine or remove based on the agreed architecture.

No existing onboarding inventory implementation has been intentionally replaced by these additional modules.

### Store Management

Store management uses the existing `Location` model rather than introducing another Store collection.

The existing location structure supports both `shop` and `warehouse` types. The new store-management routes provide a dedicated way to manage these locations while preserving the existing location model and onboarding functionality.

### Product Categories and Units

The supported product categories are:

- Fabrics
- Electronics
- Phones
- Provision
- Cosmetics
- Building Materials
- Others

Product management accepts flexible unit values as strings rather than restricting traders to a fixed list.

The onboarding product-unit dropdown also includes expanded preset choices, but these presets do not restrict the units accepted by the product-management API.

### Product Pricing Flow

Products can have multiple pricing tiers linked to the business's price profiles.

The standard profiles are:

- **Retail:** quantities 1–6.
- **Semi-wholesale:** quantities 7–19.
- **Bulk Importer:** quantities 20 and above.

Each product pricing tier stores its price profile, minimum quantity, maximum quantity, discount percentage and selling price in kobo.

The product service validates that:

- Each price profile belongs to the authenticated business.
- A product does not contain duplicate price-profile entries.
- Quantity ranges start at 1.
- Quantity ranges do not overlap or contain gaps.
- The final quantity range has no maximum quantity.

The default quantity ranges are applied to standard profiles where the trader has not supplied custom ranges.

### Product Image Upload Flow

Product image management is handled separately from product creation and updating.

The image endpoints support:

- Uploading a product image.
- Saving the Cloudinary image URL and `publicId` against the product.
- Deleting the image from Cloudinary and removing its stored reference.

This keeps image handling separate from the main product CRUD operations.

### Environment Configuration and Dependencies

Add the following Cloudinary credentials to the project's `.env` file:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

The following packages need to be installed manually:

```bash
npm install cloudinary multer
npm install -D @types/multer
```

These dependencies were deliberately not added to `package.json` or `package-lock.json`, so they can be installed and managed by the team.

### Overall Work Summary

The work introduces a trader-focused product and inventory management flow:

1. A business creates its pricing profiles.
2. The business creates and manages its shop and warehouse locations.
3. Traders create products and assign categories, units and pricing tiers.
4. Product images can be uploaded or deleted independently.
5. Stock records associate products with specific locations.
6. Stock transfers move quantities between locations and record both sides of the transaction.
7. Stock movement records provide a history of inventory activities.

The additional stock and stock-movement files are intentionally available for team review. The team can compare the different implementations and agree on the final design before deciding which files and models should become the project's standard inventory implementation.
