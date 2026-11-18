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