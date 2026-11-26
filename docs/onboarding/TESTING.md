# Onboarding testing log

Base URL: http://localhost:3800/api/onboarding
Tool: Postman. Log in first (POST /api/auth/login) so the `_ojahub` cookie is sent.

| ID | Route | Scenario | Expected | Actual | Result | Date |
| --- | --- | --- | --- | --- | --- | --- |
| T-O4 | PUT /business | First save | 200, business created, onboardingStep 1 | 200 "Business details saved", onboardingStep 1 | Pass | 17 Nov 2026 |
| T-O11 | PUT /location | First save | 200, default location created, onboardingStep 2 | 200 "Location saved", isDefault true, onboardingStep 2 | Pass | 17 Nov 2026 |
| T-O9 | PUT /product | First save | 200, product, stock and opening movement created, onboardingStep 3 | 200 "Product saved", onboardingStep 3 | Pass | 17 Nov 2026 |
| T-O10 | PUT /product | Save again with a new price and quantity | 200, same product updated, no duplicate | | | |
| T-O12 | Atlas | Product source after the typo fix | source is "onboarding" | | | |
| T-O13 | PUT /product | priceKobo below ₦1 | 400, details name priceKobo | 400 "Validation failed", priceKobo "Price must be at least ₦1" | Pass | 18 Nov 2026 |
| T-O14 | PUT /product | Negative quantity | 400, details name quantity | 400, quantity "Quantity cannot be negative" | Pass | 18 Nov 2026 |
| T-O15 | PUT /location | type "kiosk" | 400, details name type | 400, type "Invalid option: expected one of shop or warehouse" | Pass | 18 Nov 2026 |
| T-O16 | PUT /business | No cookie | 401 | 401 "Access denied. Please log in." | Pass | 18 Nov 2026 |
| T-O17 | POST /product/skip | Step 3 skipped | 200, onboardingStep stays 3 | 200 "Product step skipped", onboardingStep 3 | Pass | 18 Nov 2026 |
| T-O18 | PUT /product | Extra businessId in the body | 200, field ignored, own business updated | 200, same product _id, not touched by the body's businessId | Pass | 18 Nov 2026 |

| T-S1 | GET /api/onboarding | No cookie | 401 | 401 "Access denied. Please log in." | Pass | 18 Nov 2026 |
| T-S2 | GET /api/onboarding | User who finished step 3 | 200, step 3, saved business, location and product | 200, step 3, Test Fabrics, Main Shop, Lace Fabric 5500000 kobo, quantity 70 | Pass | 18 Nov 2026 |
| T-S3 | GET /api/onboarding | Verified user with no business | 200, step 0, all null | 200, step 0, business, location and product null | Pass | 18 Nov 2026 |
| T-S4-first | PUT and GET /business | Two users, one Postman cookie jar | Each sees own data | Inconclusive: both sessions shared one cookie jar; Atlas showed each user pointing at its own business | Inconclusive | 18 Nov 2026 |
| T-S4a | PUT /business | testtrader4 first save (separate host) | 200, new business, step 1 | 200, new business created, step 1 | Pass | 18 Nov 2026 |
| T-S4b | GET /api/onboarding | testtrader4 after save | Only own business | Only "Trader Four Phones", location and product null | Pass | 18 Nov 2026 |
| T-S4c | GET /api/onboarding | testtrader2 after testtrader4 wrote | Unchanged | Test Fabrics, Main Shop, Lace Fabric unchanged | Pass | 18 Nov 2026 |
| T-S4d | GET /api/onboarding | testtrader4 after testtrader2 wrote | Unchanged | | | |

| T-S4d-first | PUT /business | testtrader2 write, then check testtrader4 | testtrader4 unchanged | Inconclusive: the PUT went out with testtrader4's cookie (business _id 6afda755), so the direction was not tested | Inconclusive | 18 Nov 2026 |
| T-S4d | PUT /business, GET /api/onboarding | testtrader2 renames its business, then testtrader4 reads | testtrader4 still shows its own business | testtrader4 still shows "Trader Four Phones"; testtrader2's PUT returned its own business _id 6afcadbc | Pass | 18 Nov 2026 |
| T-S5 | PUT /business | Re-save step 1 after finishing step 3 | 200, onboardingStep does not go down | 200, onboardingStep stays 3 | Pass | 18 Nov 2026 |

| T-P1 | PUT /plan | No cookie (sent from PowerShell) | 401 | 401 | Pass | 19 Nov 2026 |
| T-P2 | PUT /plan | Invalid plan "weekly" | 400, details name plan | 400 "Validation failed", field plan | Pass | 19 Nov 2026 |
| T-P3 | PUT /plan | Empty body | 400, details name plan | 400 "Validation failed", field plan | Pass | 19 Nov 2026 |
| T-P4 | PUT /plan | First plan choice (monthly) | 200, trial started, 14 days, step 4 | 200 "Free trial started", trialing, daysLeft 14, step 4 | Pass | 19 Nov 2026 |
| T-P5 | PUT /plan | Change plan during the trial (yearly) | 200, plan and price updated, trial end unchanged | 200 "Plan updated", 4800000 kobo, endsAt unchanged (2026-12-03T14:05:22.014Z) | Pass | 19 Nov 2026 |
| T-P6 | PUT /plan | User still at step 1 (127.0.0.1) | 400 "Finish the earlier setup steps..." | 400 "Finish the earlier setup steps before choosing a plan" | Pass | 19 Nov 2026 |
| T-P7 | PUT /plan | Trial already over (trialEndsAt set in the past) | 409 "Your subscription has already started..." | 409 "Your subscription has already started. Change your plan from the billing screen." | Pass | 19 Nov 2026 |

monthly, six_months, yearly. Prices are in kobo. The free trial lasts 14 days from the first plan choice and is never restarted by changing plan. Status (trialing, active, expired) is calculated from the dates on each request.