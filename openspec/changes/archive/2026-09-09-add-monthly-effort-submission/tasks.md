## 1. Submission Persistence and Migration

- [x] 1.1 Add the monthly effort submission schema, unique member/month key, actor foreign keys, status and legacy metadata, repository operations, and indexes, and verify schema/repository tests cover absent-as-draft, submit, proxy actor, and invalidation fields.
- [x] 1.2 Generate a forward migration that backfills system-marked submissions for required members of existing in-review and approved months while leaving open months draft, and verify fresh, upgraded, idempotent-forward, and rollback-compatible migration tests.

## 2. Required Members and Submission Service

- [x] 2.1 Implement one required-member query using creation time, active status, and month-scoped activity/submission evidence, and verify tests cover new members after month end, inactive members with activity, active zero-hour members, and duplicate evidence.
- [x] 2.2 Implement balance validation and member/admin submission authorization for open months, and verify service tests cover own submission, denied cross-member submission, administrator proxy submission, zero-hour submission, unbalanced rejection, and protected-month rejection.
- [x] 2.3 Expose submission state, actor, timestamp, and actionable unbalanced dates through the monthly work-log loader/action and UI, and verify route/component tests cover member and administrator contexts including inactive proxy targets.

## 3. Atomic Submission Invalidation

- [x] 3.1 Add a shared transaction-scoped invalidation operation that returns submitted state to draft with actor/time metadata, and verify failed operations and already-draft states behave idempotently.
- [x] 3.2 Integrate invalidation into unified daily, total-only, allocation-delete, previous-day-copy, weekly, and monthly-bulk actual writes, and verify each successful path invalidates only affected member/months in the same transaction.
- [x] 3.3 Integrate invalidation into daily-plan-to-actual copy while leaving daily plans, monthly plans, and capacity-only changes untouched, and verify copy failures or skipped dates preserve submission state.

## 4. Monthly Close Integration

- [x] 4.1 Add missing-submission issue details and correction links to monthly completeness, and verify open-month checks use the same required-member set as submission summaries.
- [x] 4.2 Gate review start with a fresh transactional submission check and keep the approval transactional recheck, and verify missing submissions cannot freeze a month in review while complete submissions allow review and approval.
- [x] 4.3 Preserve submitted states across reopen until actual effort is written, and verify financial-only corrections do not invalidate member submissions.

## 5. Dashboard and Documentation

- [x] 5.1 Add member submission status and administrator submitted/required counts with draft-member links to the dashboard, and verify role-aware route/component tests include explicit zero-hour completion.
- [x] 5.2 Update README, user guide, business flow, release checklist, and migration/rollback notes for submission, proxy actors, invalidation, review gating, and legacy protected-month behavior, and verify terminology is consistent across UI and docs.

## 6. End-to-End Verification

- [x] 6.1 Extend browser smoke coverage through monthly review, submission, invalidation, resubmission, review start, and approval, and verify member and administrator paths remain usable on the production build.
- [x] 6.2 Run fresh and upgraded database checks plus the full test, typecheck, lint, build, and Playwright suites, and verify OpenSpec strict validation and the release checklist pass for the candidate.
