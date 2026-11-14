# OjaHub Authentication Backend

## 1. Overview

The OjaHub Authentication Backend is a secure authentication and session-management system developed for the OjaHub application.

It provides user registration, email verification, login, Google authentication, password recovery, JWT-based authentication, refresh-token rotation, session management, and role-based access control.

The system is built with Node.js, Express.js, TypeScript, MongoDB, and Mongoose.

The authentication architecture follows a modular structure that separates routes, controllers, services, models, middleware, configuration, and utility functions.

---

## 2. Technologies and Dependencies

| Technology           | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| Node.js              | JavaScript runtime                             |
| Express.js           | Backend framework                              |
| TypeScript           | Static typing                                  |
| MongoDB              | Database                                       |
| Mongoose             | MongoDB object modelling                       |
| JSON Web Token (JWT) | Authentication and session tokens              |
| bcrypt               | Password and sensitive token hashing           |
| Google Auth Library  | Google ID token verification                   |
| Nodemailer           | Sending verification and password reset emails |
| Brevo SMTP           | Email delivery service                         |
| express-rate-limit   | API rate limiting                              |
| dotenv               | Environment configuration                      |

---

## 3. Project Architecture

The project uses a modular backend architecture.

```text
src/
│
├── config/
│   ├── database.ts
│   ├── keys.ts
│   ├── logger.ts
│   └── session.ts
│
├── controllers/
│   └── authController.ts
│
├── libs/
│   ├── response-handlers.ts
│   └── tryCatchFn.ts
│
├── middlewares/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   ├── rateLimiter.ts
│   └── role.middleware.ts
│
├── models/
│   ├── user.model.ts
│   ├── business.model.ts
│   └── refreshToken.model.ts
│
├── routes/
│   └── auth.routes.ts
│
├── services/
│   └── auth.service.ts
│
├── utils/
│   ├── otp.ts
│   ├── email.ts
│   ├── password.ts
│   └── token.ts
│
├── types/
│   └── express.ts
│
├── app.ts
└── index.ts
```

### Responsibilities of Each Layer

**Config**

- Establishes database connections.
- Loads and validates environment variables.
- Configures logging.
- Configures session middleware.

**Controllers**

- Receive HTTP requests.
- Extract request data.
- Call the appropriate service.
- Return standardized API responses.

**Services**

- Contain the main authentication business logic.
- Handle registration, login, verification, Google authentication, password recovery, and session management.
- Interact with database models.

**Models**

- Define MongoDB document structures and database relationships.
- Manage user information, business records, and refresh-token sessions.

**Routes**

- Define authentication API endpoints.
- Connect endpoints to controllers.
- Apply appropriate middleware and rate limiters.

**Middlewares**

- Authenticate requests.
- Authorize user roles.
- Apply rate limits.
- Handle application errors.

**Utils**

- Generate and hash OTPs.
- Send emails.
- Hash and compare passwords.
- Generate and verify authentication tokens.

**Libs**

- Provide reusable response handlers.
- Provide asynchronous error-handling functionality.

---

# 4. Authentication Features

## 4.1 User Registration

Users can create accounts using their personal and login information.

Registration collects:

- Name
- Email address
- Phone number
- Password

### Registration Process

1. Receive registration information.
2. Normalize the email address by trimming whitespace and converting it to lowercase.
3. Validate the supplied information.
4. Hash the password using bcrypt.
5. Create a separate business record for the new user.
6. Create the user account and associate it with the business.
7. Generate an email verification OTP.
8. Hash the OTP before storing it.
9. Set the OTP expiration time.
10. Send the verification code to the user's email address.

New accounts must verify their email addresses before they can log in using the normal password-based login flow.

### Password Requirements

Passwords must satisfy the following requirements:

- Minimum of 8 characters.
- At least one uppercase letter.
- At least one number.
- At least one special character.

Passwords are never stored as plain text.

---

## 4.2 Email Verification

Email verification confirms ownership of the email address supplied during registration.

The system uses a One-Time Password (OTP) sent through email.

### OTP Security

- OTPs are generated using a random generator.
- OTPs are hashed before being stored.
- OTPs have an expiration time.
- Users have a maximum number of verification attempts.
- Expired OTPs cannot be used.
- Resending OTPs is protected by a cooldown.
- Hourly resend limits prevent excessive requests.

### Verification Process

1. The user receives an OTP through email.
2. The user submits the OTP.
3. The submitted OTP is compared against the stored hash.
4. The system checks whether the OTP has expired.
5. The system checks the number of previous attempts.
6. If valid, the user's email verification status is updated.
7. Verification OTP information is cleared.

### Resending Verification OTP

Users can request another verification code.

The resend functionality checks:

- Whether the user exists.
- Whether the email has already been verified.
- Whether the resend cooldown has elapsed.
- Whether the hourly resend limit has been reached.

A new OTP is generated and hashed before being stored.

---

## 4.3 Login

Users can authenticate using either:

- Email address.
- Phone number.

### Login Process

1. Receive the login identifier and password.
2. Find the user using the supplied email or phone number.
3. Retrieve the stored password hash.
4. Verify the password using bcrypt.
5. Check the user's email verification status.
6. Check whether the account is temporarily locked.
7. Reset failed login attempts after successful authentication.
8. Generate an access token.
9. Generate a refresh token.
10. Hash and store the refresh token in the database.
11. Return the authenticated user information and tokens.

### Failed Login Protection

The system protects accounts against repeated incorrect password attempts.

- Five consecutive failed login attempts trigger a temporary account lockout.
- The lockout lasts for 10 minutes.
- A successful login resets the failed login counter.

---

## 4.4 Google Sign-In

The authentication system supports Google authentication using Google ID tokens.

The implementation uses the `google-auth-library` package.

### Google Authentication Process

1. The client application obtains a Google ID token through Google Sign-In.
2. The client sends the ID token to the backend.
3. The backend verifies the token using Google's authentication library.
4. The backend checks the token audience against the configured Google Client ID.
5. The backend retrieves the verified Google account information.
6. The system checks that the token contains a valid subject and email.
7. The system confirms that the Google email is verified.
8. The backend searches for an existing user using the Google ID or email address.
9. If an existing account is found, the Google account is linked where appropriate.
10. If no account exists, a new user and associated business are created.
11. Access and refresh tokens are generated.
12. The user is authenticated.

### Google Account Security

The backend checks:

- Google token validity.
- Token audience.
- Token issuer and expiration through Google's verification library.
- Google account identifier (`sub`).
- Email availability.
- Email verification status.

The backend does not accept an arbitrary email address as proof of Google identity. It verifies the signed Google ID token.

---

## 4.5 Forgot Password

The forgot-password functionality allows users to recover access to their accounts.

### Process

1. The user submits their email address.
2. The system searches for the corresponding account.
3. If the account qualifies for password recovery, an OTP is generated.
4. The OTP is hashed and stored.
5. An expiration time is assigned.
6. The OTP is sent to the user's email address.

The system also applies resend cooldowns and hourly request limits.

---

## 4.6 Reset Password

Users can reset their passwords using a valid password-reset OTP.

### Process

1. The user submits the email address, OTP, and new password.
2. The system retrieves the corresponding account.
3. The submitted OTP is verified against its stored hash.
4. The system checks OTP expiration.
5. The system checks the maximum number of verification attempts.
6. The new password is validated against the password requirements.
7. The system checks that the new password is different from the current password.
8. The new password is hashed using bcrypt.
9. The user's password is updated.
10. Password-reset OTP information is cleared.
11. Existing refresh-token sessions are deleted.

Deleting existing refresh-token sessions forces users to authenticate again on their devices after a successful password reset.

---

# 5. JWT Authentication and Session Management

The system uses two types of JWTs:

### Access Token

- Used to authenticate protected API requests.
- Expires after 15 minutes.
- Sent through the Authorization header.

### Refresh Token

- Used to obtain a new access token.
- Has a configurable session duration of 7 or 30 days.
- Stored as a hash in the database rather than as a plain-text token.

### Remember Me

The authentication system supports two session durations:

| Remember Me | Session Duration |
| ----------- | ---------------- |
| Disabled    | 7 days           |
| Enabled     | 30 days          |

### Refresh Token Rotation

Refresh-token rotation improves session security.

The process works as follows:

1. The client submits its refresh token.
2. The backend verifies the token.
3. The backend hashes the submitted token.
4. The database is searched for the matching stored hash.
5. The session expiration is checked.
6. The existing refresh-token record is atomically replaced or consumed.
7. A new access token and refresh token are generated.
8. The new refresh token is hashed and stored.
9. The new tokens are returned to the client.

The rotation process prevents an already-used refresh token from being reused successfully.

### Session Storage

The refresh-token model stores information associated with each session, including:

- User reference.
- Hashed refresh token.
- Expiration date.
- Session duration.

A unique index is used for token-hash uniqueness.

---

# 6. Logout Functionality

The system supports two logout operations.

### Logout from Current Device

The current refresh-token session is invalidated.

Other active sessions belonging to the user remain unaffected.

### Logout from All Devices

All refresh-token sessions belonging to the authenticated user are deleted.

This invalidates the user's existing refresh-token sessions across devices.

---

# 7. Authentication Middleware

## 7.1 Authentication Middleware

The authentication middleware protects routes that require a logged-in user.

### Responsibilities

1. Read the access token from the Authorization header.
2. Validate the JWT.
3. Retrieve the authenticated user from the database.
4. Attach the authenticated user's information to the Express request.
5. Allow the request to continue.

The middleware attaches relevant user information, including:

- User ID.
- Role.
- Business ID.

Requests with missing or invalid authentication credentials are rejected.

### Authorization Header

Protected requests should include:

```http
Authorization: Bearer ACCESS_TOKEN
```

## 7.2 Role-Based Authorization

The role middleware restricts access to routes based on user roles.

Supported roles include:

- `user`
- `admin`

The `authorizeRoles()` middleware accepts the roles permitted to access a particular route.

This allows the application to restrict administrative functionality to authorized users.

---

# 8. Rate Limiting

The authentication system uses `express-rate-limit` to reduce abuse and excessive requests.

Three rate limiters are implemented.

| Rate Limiter   | Time Window | Maximum Requests |
| -------------- | ----------- | ---------------- |
| Authentication | 15 minutes  | 20               |
| OTP            | 15 minutes  | 5                |
| Password Reset | 15 minutes  | 5                |

### Authentication Rate Limiter

Protects authentication endpoints against excessive requests.

### OTP Rate Limiter

Protects OTP-related endpoints against excessive verification and resend requests.

### Password Reset Rate Limiter

Protects password recovery endpoints against excessive requests.

The application also implements OTP-specific cooldowns and resend limits independently of the general rate limiters.

---

# 9. Database Models

The authentication implementation uses three main models.

## 9.1 User Model

The user model stores account information and authentication-related fields.

The implemented user information includes:

- User ID.
- Name.
- Email.
- Phone number.
- Password hash.
- Google ID.
- Role.
- Business ID.
- Email verification status.
- Login failure and lockout information.
- Email verification OTP information.
- Password reset OTP information.

Sensitive fields, such as password hashes, are handled through appropriate model selection and security logic.

## 9.2 Business Model

Each newly registered user receives a separate business record.

The business record is associated with the user through the `businessId` field.

Google-authenticated users who are new to the application also receive a business record.

## 9.3 Refresh Token Model

The refresh-token model manages individual authentication sessions.

It stores:

- User reference.
- Hashed refresh token.
- Expiration date.
- Session duration.

This supports individual-device logout, logout from all devices, and refresh-token rotation.

---

# 10. Email Service

The application uses Nodemailer with Brevo SMTP to deliver authentication emails.

Email functionality includes:

- Account verification emails.
- Password reset emails.

OTP values are generated and hashed by the authentication utilities before being stored.

The email service receives the generated OTP and sends it to the appropriate email address.

SMTP credentials are loaded through environment configuration.

---

# 11. API Documentation

## Base URL

Local development:

```text
http://localhost:3800/api/auth
```

### Authentication Endpoints

| Method | Endpoint           | Description                       |
| ------ | ------------------ | --------------------------------- |
| POST   | `/register`        | Register a new user               |
| POST   | `/verify-email`    | Verify email using OTP            |
| POST   | `/resend-otp`      | Resend verification OTP           |
| POST   | `/login`           | Authenticate using email or phone |
| POST   | `/google`          | Authenticate using Google         |
| POST   | `/forgot-password` | Request password recovery OTP     |
| POST   | `/reset-password`  | Reset account password            |
| POST   | `/refresh`         | Refresh authentication tokens     |
| POST   | `/logout`          | Logout from the current device    |
| POST   | `/logout-all`      | Logout from all devices           |

The exact request validation and response types are defined in the authentication implementation. The examples below illustrate the principal request formats; consult the corresponding controller and service for any additional required fields.

---

## 11.1 Register User

**POST** `/register`

Example request:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "+2347067912033",
  "password": "Test@12345"
}
```

Description:

Creates a user account, creates an associated business, hashes the password, and sends an email verification OTP.

---

## 11.2 Verify Email

**POST** `/verify-email`

Description:

Verifies a user's email address using the OTP sent during registration.

The request must contain the email and verification OTP as defined by the verification controller.

---

## 11.3 Resend OTP

**POST** `/resend-otp`

Description:

Requests a new email verification OTP.

The request identifies the account using its email address.

---

## 11.4 Login

**POST** `/login`

Description:

Authenticates a user using an email address or phone number and password.

The login request also supports the Remember Me session option.

---

## 11.5 Google Login

**POST** `/google`

Example request:

```json
{
  "idToken": "GOOGLE_ID_TOKEN"
}
```

Description:

Verifies the Google ID token and authenticates the corresponding user.

The ID token must be generated by Google using the configured OAuth Client ID.

---

## 11.6 Forgot Password

**POST** `/forgot-password`

Description:

Initiates password recovery by generating and emailing a password-reset OTP.

---

## 11.7 Reset Password

**POST** `/reset-password`

Description:

Validates the password-reset OTP and updates the user's password.

The request must contain the account identifier, OTP, and new password according to the reset-password controller.

---

## 11.8 Refresh Token

**POST** `/refresh`

Description:

Validates the submitted refresh token, checks the associated session, rotates the refresh token, and returns new authentication tokens.

---

## 11.9 Logout

**POST** `/logout`

Description:

Invalidates the authenticated user's current refresh-token session.

---

## 11.10 Logout All

**POST** `/logout-all`

Description:

Invalidates all refresh-token sessions associated with the authenticated user.

---

# 12. Standard API Responses

The application uses standardized response handlers to maintain consistency across API responses.

### Successful Response

Example:

```json
{
  "success": true,
  "message": "Operation successful",
  "body": {}
}
```

The `body` contains the relevant response data for the operation.

### Error Response

Example:

```json
{
  "success": false,
  "message": "Invalid Google ID token"
}
```

HTTP status codes communicate the outcome of requests.

Examples include:

- `200` – Successful request.
- `400` – Invalid request or validation error.
- `401` – Authentication failure.
- `403` – Insufficient permissions.
- `404` – Resource not found.
- `409` – Conflict.
- `429` – Rate limit exceeded.
- `500` – Internal server error.

The exact status code depends on the operation and error condition.

---

# 13. Environment Configuration

The application uses environment variables to manage configuration and sensitive credentials.

Create a `.env` file in the project root.

Configure the environment variables required by `src/config/keys.ts`, including the following categories:

| Configuration          | Purpose                          |
| ---------------------- | -------------------------------- |
| `MONGO_URI`            | MongoDB connection string        |
| `DB_NAME`              | Database name                    |
| `NODE_ENV`             | Application environment          |
| `PORT`                 | Server port                      |
| JWT secrets            | Access and refresh token signing |
| Session secrets        | Session middleware configuration |
| Google Client ID       | Google ID token verification     |
| Brevo SMTP credentials | Email delivery configuration     |

The exact JWT, session, and SMTP variable names must match those defined in the project's environment configuration.

Never commit `.env` to GitHub.

Use `.env.example` to document the required environment variable names without including real credentials.

---

# 14. Installation and Setup

## Prerequisites

Install the following:

- Node.js
- npm
- MongoDB database
- Git

## Clone the Repository

```bash
git clone <repository-url>
```

Navigate into the project directory:

```bash
cd ojahub-team-backend
```

Install dependencies:

```bash
npm install
```

Configure your environment variables in `.env`.

## Run the Development Server

```bash
npm run dev
```

The application runs using the configured development environment and port.

## TypeScript Validation

Run:

```bash
npx tsc -p src/tsconfig.json --noEmit
```

This checks the TypeScript source files for compilation errors without generating build files.

---

# 15. Testing

The authentication API can be tested independently of the frontend using Thunder Client or Postman.

### Recommended Testing Sequence

1. Register a new user.
2. Confirm that the verification email is received.
3. Verify the email using the OTP.
4. Test OTP resend functionality.
5. Log in using email and password.
6. Log in using phone number and password.
7. Test invalid password handling.
8. Test unverified account login restrictions.
9. Test failed login lockout.
10. Test Google authentication.
11. Test forgot-password functionality.
12. Test password reset.
13. Test access-token authentication on protected routes.
14. Test refresh-token rotation.
15. Test logout from the current device.
16. Test logout from all devices.
17. Test rate limiting.

### Google Authentication Testing

Google authentication requires a valid Google ID token.

For independent backend testing, a temporary Google Sign-In page can be used to obtain an ID token with the same OAuth Client ID configured in the backend.

The ID token is then submitted to:

```text
POST http://localhost:3800/api/auth/google
```

Example body:

```json
{
  "idToken": "GOOGLE_ID_TOKEN"
}
```

The temporary testing page is not part of the production authentication implementation.

---

# 16. Security Considerations

The authentication system incorporates several security mechanisms:

- Passwords are hashed using bcrypt.
- OTPs are hashed before database storage.
- Refresh tokens are stored as hashes.
- Access tokens have a short expiration time.
- Refresh tokens are rotated.
- OTPs expire.
- OTP verification attempts are limited.
- OTP resending is protected by cooldowns and hourly limits.
- Failed login attempts trigger temporary lockout.
- Authentication endpoints use rate limiting.
- Google ID tokens are verified by Google's authentication library.
- Email verification is required for normal password-based login.
- Password reset invalidates existing refresh-token sessions.
- Protected routes require valid access tokens.
- Role-based middleware restricts access to authorized roles.

Sensitive credentials must remain in environment variables and must never be exposed in public repositories.

---

# 17. Development Status

The authentication implementation includes:

- User registration.
- Email verification.
- OTP generation, hashing, expiry, and resend protection.
- Email and phone login.
- Password hashing.
- Failed login protection.
- Google authentication.
- Forgot-password and reset-password functionality.
- Access and refresh JWT generation.
- Remember Me sessions.
- Refresh-token rotation.
- Single-device logout.
- Logout from all devices.
- Authentication middleware.
- Role-based authorization.
- Authentication rate limiting.
- Centralized error handling.
- Email delivery integration.

Individual features should be tested end to end before being considered fully verified.

---

# 18. Contributors

OjaHub Backend Team

---

## License

This project is part of the OjaHub application.
