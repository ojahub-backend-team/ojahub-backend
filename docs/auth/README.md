# Auth module

Session-based authentication (express-session + connect-mongo, cookie `_ojahub`).

Status: work in progress on branch `review/auth-fixes`. Full changelog to follow.

## Frontend integration

- Authentication is cookie-based. The cookie is named `_ojahub` and is `httpOnly`, so JavaScript cannot read it. Never store or send a token.
- Every request must send cookies:
  - fetch: `credentials: "include"`
  - axios: `withCredentials: true`
- No `Authorization` header is used.
- Success response: `{ success: true, message, body? }`
- Error response: `{ success: false, message, details? }`
- A 401 on any protected route means no session: send the user to the login screen.
- "Keep me logged in" is sent as `rememberMe: true` in the login body. It keeps the session for 30 days instead of 24 hours.
- Rate limits (15 minutes): 20 requests for register/login/google, 5 for OTP routes, 5 for password reset. Over the limit returns 429.