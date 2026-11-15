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

| Sprint | Scope |
| --- | --- |
| 1 | Foundation, authentication, onboarding, subscription expiry check |
| 2 | Products, locations, stock, customers |
| 3 | Invoices, payments, webhooks |
| 4 | Notifications, offline sync |
| After 3 | Platform admin (separate login, roles, two-step verification) |

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
