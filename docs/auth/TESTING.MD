# Auth testing log

Base URL: http://localhost:3800/api/auth
Tool: Postman, collection "OjaHub Auth", one cookie jar per user.

| ID | Route | Scenario | Expected | Actual | Result | Date |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | POST /login | Verified user, correct password | 200, `_ojahub` cookie set | | | |
| T-02 | POST /login | rememberMe true | cookie expires in about 30 days | | | |
| T-03 | POST /login | rememberMe false or missing | cookie expires in about 24 hours | | | |
| T-04 | Atlas | After login | a document in `sessions` with `session.userId` | | | |
| T-05 | POST /logout-all | With session | 200, session document deleted | | | |
| T-06 | POST /logout-all | Again, no session | 401 "Access denied. Please log in." | | | |
| T-07 | POST /logout | With session | 200, cookie cleared | | | |
| T-08 | POST /logout | No session | 200 (safe to repeat) | | | |