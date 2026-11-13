# Auth testing log

Base URL: http://localhost:3800/api/auth
Tool: Postman, collection "OjaHub Auth", one cookie jar per user.

| ID | Route | Scenario | Expected | Actual | Result | Date |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | POST /login | Verified user, correct password | 200, `_ojahub` cookie set | pass | | |
| T-02 | POST /login | rememberMe true | cookie expires in about 30 days | Pass (13 Dec 2026)  | | |
| T-03 | POST /login | rememberMe false or missing | cookie expires in about 24 hours | Pass (14 Nov 2026) | | |
| T-04 | Atlas | After login | a document in `sessions` with `session.userId` | pass | | |
| T-05 | POST /logout-all | Logged in With session | 200, session document deleted, cookie cleared | 200, session gone, cookie cleared | pass | 13 Nov 2026 |
| T-06 | POST /logout-all | Again, no session | 401 "Access denied. Please log in." | 401 "Acess denied. Please log in"| pass | 13 Nov 2026 |
| T-07 | POST /logout | With session | 200, cookie cleared, session deleted | 200, as expected | pass | 13 Nov 2026 |
| T-08 | POST /logout | No session | 200 (safe to repeat) | 200 | pass | 13 Nov 2026 |
| T-9 | POST/login | Verified user logs in after the token code is removed | 200, _ojahub cookie set, response body contains only user (no accessToken or refreshToken) | 200 “Login successful”. The body contains only user (_id, name, email, phone, role, businessId, emailVerified). The _ojahub cookie is set. | pass | 13 Nov 202
T-10 | POST /refresh-token | The refresh-token route has been removed	404 catch-all, because the route no longer exists |  404, {"success": false, "message": "Cannot find route - /api/auth/refresh-token on this server. please check the url and try again"} | pass | 13 Nov 2026

ID	Route	Scenario	Expected	Actual	Result

T-R1	POST /register	Email or phone already registered	409 “Email or phone number already exists”	409, same message	Pass

| T-R2 | POST /register | New user, verification email cannot be sent | 201, user created | 500 connect ETIMEDOUT <smtp host>:587 after about 24 s. The user and business are still saved. | Bug, fix in P0 step 7 | 13 Nov 2026 |

Resolved (P0.4): login no longer returns tokens. The session cookie `_ojahub` is the only credential. The `/refresh-token` route no longer exists, so the frontend must not call it.

ID	Route	Scenario	Expected	Actual	Result	Date

T-V1	POST /verify-email	Wrong code	400 “Incorrect verification code”, no cookie	400 “Incorrect verification code”	Pass	13 Nov 2026

| T-V2 | POST /verify-email | Correct code | 200, user with emailVerified: true, _ojahub cookie set, session in Atlas | 200 “Email verified successfully”. _ojahub cookie set, expires in 24 hours. Session document in Atlas with session.userId matching the user. | Pass | 13 Nov 2026 |

T-V3	POST /verify-email	Same code again	400 “Email is already verified”	400 “Email is already verified”	Pass	13 Nov 2026