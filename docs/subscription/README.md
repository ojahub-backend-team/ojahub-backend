# Subscription

- GET /api/subscription/plans lists the plans, prices in kobo, and the trial length (14 days).
- GET /api/subscription returns the business's status (`none`, `trialing`, `active`, `expired`), `canWrite`, and the plan details.
- PUT /api/onboarding/plan (step 4) chooses a plan and starts the free trial. It cannot be skipped.
- Changing plan during the trial never restarts the trial. After the trial, plan changes belong to billing (Sprint 3).
