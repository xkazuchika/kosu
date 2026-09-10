## 1. Specification Structure

- [x] 1.1 Restore the two monthly-workflow next-action scenarios to `Dashboard next-action guidance`, keep only submission-specific scenarios under `Monthly submission dashboard status`, and verify a structural assertion identifies the intended owning requirement for each scenario.

## 2. Transactional Period Protection

- [x] 2.1 Recheck the effective monthly close state through the transaction handle before writes in monthly bulk entry, previous-day copy, and daily-plan-to-actual copy, and verify existing effort changes and submission invalidation remain in the same transaction.
- [x] 2.2 Add regression tests that force the month to become protected after preliminary validation and verify each affected path persists neither effort data nor submission invalidation.

## 3. Persisted Submission Integrity

- [x] 3.1 Add Drizzle schema checks for supported monthly submission status and real `YYYY-MM` month values, generate the forward migration, and verify the generated SQL rebuild preserves unique indexes and actor foreign keys.
- [x] 3.2 Extend fresh and upgraded database tests to verify valid draft, submitted, invalidated, and legacy rows survive migration while malformed status and month writes are rejected atomically.

## 4. Release Verification

- [x] 4.1 Update migration and release documentation where needed to describe the new submission constraints and forward-only rollback expectation, and verify terminology matches the main specifications.
- [x] 4.2 Run focused tests plus the full test, typecheck, lint, build, migration, `git diff --check`, and OpenSpec strict validation gates, and verify the candidate has no untracked generated artifacts or unexplained failures.
