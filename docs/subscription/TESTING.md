# Subscription testing log

Base URL: http://localhost:3800/api/subscription
Tool: Postman. Log in first (POST /api/auth/login) so the `_ojahub` cookie is sent.

| ID | Route | Scenario | Expected | Actual | Result | Date |
| --- | --- | --- | --- | --- | --- | --- |
| T-G1 | GET /plans | No session | 401 | 401 "Access denied. Please log in." | Pass | 20 Nov 2026 |
| T-G2 | GET /plans | Logged in | 200, trialDays 14, 3 plans in kobo | 200, monthly 500000, six_months 2700000, yearly 4800000 | Pass | 20 Nov 2026 |
| T-G3 | GET / | Business in trial | 200, trialing, canWrite true | 200, trialing, canWrite true, yearly plan, daysLeft 14 | Pass | 20 Nov 2026 |
| T-G4 | GET / | Business with no plan chosen | 200, none, canWrite false | 200, none, canWrite false, subscription null | Pass | 20 Nov 2026 |
| T-G5 | GET / | Trial date in the past | 200, expired, canWrite false, daysLeft 0 | 200, expired, canWrite false, daysLeft 0 | Pass | 20 Nov 2026 |
| T-G6 | GET / | No session | 401 | 401 "Access denied. Please log in." | Pass | 20 Nov 2026 |


Notes for the frontend:
- `status` is `none` (show the plan screen, onboarding step 4), `trialing` or `active` (normal use), or `expired` (plan-ended screen).
- `daysLeft` rounds up.
- Status is calculated from the dates on every request.


| T-X1 | POST (gated route) | Business in trial | 200 | 200 | Pass | 20 Nov 2026 |
| T-X2 | POST (gated route) | Business with no plan chosen | 403, code SUBSCRIPTION_REQUIRED | 403 "Choose a plan to start your free trial", code SUBSCRIPTION_REQUIRED | Pass | 20 Nov 2026 |
| T-X3 | GET (gated route) | Business with no plan chosen | 200, reads always allowed | 200 | Pass | 20 Nov 2026 |
| T-X4-first | POST (gated route) | Expired business | 403, code SUBSCRIPTION_EXPIRED | 200: the expired check was missing from the middleware | Fail, fixed | 20 Nov 2026 |
| T-X4 | POST (gated route) | Expired business, after the fix | 403, code SUBSCRIPTION_EXPIRED | 403 "Your subscription has ended...", code SUBSCRIPTION_EXPIRED | Pass | 20 Nov 2026 |
| T-X5 | GET (gated route) | Expired business | 200, reads allowed | 200 | Pass | 20 Nov 2026 |
| T-X6 | POST (gated route) | Date restored to the future | 200 | 200 | Pass | 20 Nov 2026 |
| T-X7 | POST (gated route) | No session | 401 | 401 | Pass | 20 Nov 2026 |

Business routes return 403 with details.code = SUBSCRIPTION_REQUIRED (go to the plan screen) or SUBSCRIPTION_EXPIRED (show the plan-ended screen). ONBOARDING_REQUIRED means finish setup first. The gate was tested on a temporary route, which has since been removed. It is attached to the real business routes from Sprint 2.