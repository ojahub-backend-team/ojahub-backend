# Auth and onboarding module

Session-based authentication for the OjaHub backend. Cookie `_ojahub`, sessions stored in MongoDB (express-session + connect-mongo). JWT and refresh tokens were removed.

Base URL (local): `http://localhost:3800`

## How it works

1. `POST /api/auth/register` creates the account. It does NOT log the user in.
2. `POST /api/auth/verify-email` checks the 6-digit code, marks the email verified and starts the session (the Figma flow: Create account, OTP, "Verify and continue", straight into onboarding).
3. `PUT /api/onboarding/business` (onboarding step 1) creates the business, attaches it to the user and stores its ID in the session.
4. Every later request sends the cookie. The server reads `userId`, `role` and `businessId` from the session.

Login (`POST /api/auth/login`) is for returning users and requires a verified email.

## Frontend integration

- The cookie is `httpOnly`. JavaScript cannot read it and must never store a token.
- Send cookies on every request: fetch `credentials: "include"`, axios `withCredentials: true`.
- No `Authorization` header.
- Allowed dev origins: `http://localhost:5173` and `http://127.0.0.1:5173`.
- A 401 on a protected route means there is no session: show the login screen.
- A 403 with `details.code` = `ONBOARDING_REQUIRED` means the user has no business yet: show onboarding.
- `user.businessId` is absent until onboarding step 1 is saved.

Response shapes:

```json
{ "success": true, "message": "...", "body": { } }
{ "success": false, "message": "..." }
{ "success": false, "message": "Validation failed", "details": [{ "field": "email", "message": "Enter a valid email address" }] }
```

User object: `_id`, `name`, `email`, `phone`, `role`, `businessId` (optional), `emailVerified`.

Rate limits (per IP, 15 minutes): 20 on register, login and Google; 5 on verify-email and resend-otp; 5 on forgot and reset password. Over the limit returns 429.

## Auth routes (`/api/auth`)

| Method and path | Body | Success | Errors |
| --- | --- | --- | --- |
| POST /register | name, email, phone, password | 201, `body.user`. No session. | 400 validation or password rules, 409 email or phone already used, 503 verification email could not be sent (nothing is saved) |
| POST /verify-email | email, otp (6 digits) | 200, `body.user`, sets `_ojahub` | 400 incorrect code, 400 "Email is already verified" |
| POST /resend-otp | email | 200 | 400, 404 |
| POST /login | emailOrPhone, password, rememberMe (boolean, optional) | 200, `body.user`, sets `_ojahub` | 400 validation, 401 wrong credentials |
| POST /google | idToken | 200, `body.user`, sets `_ojahub` | 400, 401 |
| POST /forgot-password | email | 200, always the same message | 400 validation |
| POST /reset-password | email, otp, newPassword | 200, all sessions of the user are deleted | 400 wrong, expired or same-as-current password |
| POST /logout | none | 200, session destroyed, cookie cleared. Safe without a session. | none |
| POST /logout-all | none, needs session | 200, every session of the user deleted | 401 no session |

Notes:
- Phone numbers are normalised to `+234...` (0801..., 234801... and +234801... are all accepted). Emails are lowercased.
- `rememberMe: true` keeps the cookie for 30 days. Otherwise 24 hours.
- A new code expires after 10 minutes. Forgot password: 60 seconds between codes, 5 codes per hour. It never says whether an email is registered. Show "If that email is registered, a code has been sent."
- Password rule currently enforced by the server: 8+ characters, a number, an uppercase letter and a special character (Figma says 8+ and a number; decision pending).

## Onboarding (`/api/onboarding`)

| Method and path | Body | Success | Errors |
| --- | --- | --- | --- |
| PUT /business | name, category, businessLocation | 200, `body.business`, `body.onboardingStep` | 400 validation, 401 no session |

- Categories: Fabrics, Electronics, Phones, Provision, Cosmetics, Building Materials, Others.
- It is repeatable: sending it again updates the same business (one business per owner).
- It sets `onboardingStep` to at least 1 and updates the session, so `businessId` is available at once.
- Steps 2 to 4 (first location, first product, plan) are not built yet. Each step must only raise `onboardingStep`.

## For backend developers

- `verifySession` (middlewares/auth.middleware.ts): 401 without a session. Sets `req.user` (`_id`, `role`, `businessId`).
- `requireBusiness`: 403 `ONBOARDING_REQUIRED` if the user has no business. Use it after `verifySession` on every route that touches business data.
- `requireRole("admin")`, `requireAdmin`: role checks.
- Every query on business data must filter by `req.user.businessId`. Never take a business ID from the request body or URL.
- `validate(schema)` (middlewares/validate.middleware.ts): put it after the rate limiter and before the controller. Schemas live in `src/validators/auth.validator.ts`. It replaces `req.body` with the cleaned data.
- Session helpers: `startSession`, `updateSessionBusiness` (utils/startSession.ts); `endSession`, `destroyAllUserSessions` (utils/sessionCleanup.ts).

## Run and test it

1. `git fetch origin`, then `git checkout review/auth-fixes`, then `npm install`.
2. Copy `.env.example` to `.env` and fill the values (ask the team lead privately for secrets). Use your OWN `DB_NAME` so you do not overwrite other people's test data.
3. `npm run dev` (port 3800).
4. Import `docs/auth/ojahub-auth.postman_collection.json` into Postman and set the `baseUrl` variable.
5. Verification emails need a working SMTP connection. If emails cannot be sent on your network, register returns 503. For testing, create the user in Atlas (or set `emailVerified` to true by hand) and log in.
6. Full test log: `docs/auth/TESTING.md`.

## Changelog

| Step | Files | What changed and why |
| --- | --- | --- |
| P0.1 | routes/auth.routes.ts | Use verifySession so the server starts |
| P0.2 | utils/startSession.ts, controllers, services | One session helper. Session regenerated at login. Session starts at verify-email, not register. Keep me logged in sets the cookie lifetime |
| P0.3 | utils/sessionCleanup.ts, controllers, services | Logout destroys the session. Logout-all and reset-password delete all user sessions |
| P0.4 | multiple | JWT, refresh tokens, token model and utils removed |
| P0.5 | models, services, middleware, routes | Business created at onboarding step 1. requireBusiness added. businessId optional |
| P0.6 | validators, middleware, routes | Zod validation on all auth routes and onboarding |
| P0.7 | services/auth.service.ts | Forgot-password fixed, same-password check works, no orphan user when the email fails, Google linking no longer keeps an unverified password |
| CORS | app.ts | http dev origins and PUT allowed, invalid headers removed |

## Known limitations

- Cookie `sameSite` and `secure` for production depend on whether the frontend and API are on the same site (pending).
- Malformed JSON still returns 500 (error handler fix is planned).
- Password strength rule differs between Figma and code (pending decision).
- `resend-otp` and Google login are not covered by the test log yet.
- Platform admin (separate login and two-step verification) is not built.