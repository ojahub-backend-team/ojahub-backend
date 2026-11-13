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


ID	Route	Scenario	Expected	Actual	Result

T-R1	POST /register	Email or phone already registered	409 “Email or phone number already exists”	409, same message	Pass

T-R2	POST /register	New user, email can’t be sent (Brevo not configured)	201	500, but the user is saved in the database	Bug, fix in P0 step 7