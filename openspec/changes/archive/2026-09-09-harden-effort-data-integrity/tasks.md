## 1. Shared Domain Validation

- [x] 1.1 Add strict real-calendar-date and bounded quarter-hour helpers in the time utilities, and verify unit tests cover leap days, impossible dates, non-quarter values, 24 hours, and values over 24.
- [x] 1.2 Add a reusable optional non-negative safe-integer yen parser for hourly cost rates, and verify unit tests cover empty, zero, positive, negative, fractional, non-finite, and unsafe values.

## 2. Daily Effort Integrity

- [x] 2.1 Add repository support to find and reactivate a logically deleted member/date work log while leaving deleted allocations inactive, and verify repository tests cover clear-then-recreate and uniqueness.
- [x] 2.2 Apply strict date, per-value, and combined 24-hour validation to unified daily saves and total-hours-only saves, and verify service and route tests preserve bounded imbalance warnings and atomic failure.
- [x] 2.3 Apply the shared validation to weekly entry, monthly bulk entry, and daily allocation plan dates, and verify route/service tests reject impossible dates and over-24-hour submissions without partial writes.
- [x] 2.4 Add regression coverage for re-entering a cleared day from monthly bulk, daily total-only, unified daily, weekly, and planned-to-actual paths, and verify deleted allocations are never restored.

## 3. Member Cost Validation

- [x] 3.1 Use the shared yen parser in member create and edit actions and add matching HTML input constraints, and verify route tests reject invalid rates while accepting empty and zero values.
- [x] 3.2 Apply the same hourly-rate validation to member CSV preview and commit, and verify invalid imported rates cannot reach member records or later cost snapshots.

## 4. Active Assignment Integrity

- [x] 4.1 Add a migration that deterministically marks duplicate active assignments as removed and creates a partial unique active-assignment index, and verify fresh and upgraded migration tests preserve all rows with exactly one active row per member/project.
- [x] 4.2 Centralize assignment target and duplicate validation for administrator, self-assignment, and import writes, and verify inactive members, archived projects, and duplicate requests are rejected consistently.
- [x] 4.3 Implement administrator editing of the existing active assignment role rather than creating a new row, and verify route and repository tests preserve removed assignment history.

## 5. CSV Rule Parity

- [x] 5.1 Validate supported boolean values and active-member/project eligibility for member, assignment, capacity, and monthly-plan imports, and verify preview reports row-level errors for each invalid lifecycle state.
- [x] 5.2 Revalidate every applicable row and monthly-close guard inside the existing atomic commit transaction, and verify state changes between preview and commit produce zero imported rows.
- [x] 5.3 Add optional `effortBudgetHours` to project templates, import mapping, validation, and export, and verify valid round-trip, invalid-value rejection, preservation when the optional column is absent, and compatibility with older project CSV headers.

## 6. Documentation and Quality Gates

- [x] 6.1 Update the user guide, README import notes, and release checklist for date/hour/rate constraints, project effort-budget CSV support, assignment cleanup, and rollback limits, and verify the documented templates match generated output.
- [x] 6.2 Run database migration and foreign-key checks plus the full test, typecheck, lint, build, and Playwright smoke suites, and verify the working tree contains only intended change files and generated migration metadata.
