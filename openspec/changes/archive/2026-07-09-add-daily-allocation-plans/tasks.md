## 1. Data Model And Repositories

- [x] 1.1 Add `daily_allocation_plans` schema and migration with unique member/date/project constraint.
- [x] 1.2 Add repository functions for list-by-month, list-by-date, find, upsert, delete, and aggregate totals.
- [x] 1.3 Add repository tests for create, update, delete, uniqueness, month listing, and aggregation.

## 2. Validation And Copy Services

- [x] 2.1 Add validation helpers for month/date scope, positive 0.25h increments, blank/zero-as-delete, and daily total <= 24h.
- [x] 2.2 Add project eligibility checks for active projects assigned to the target member.
- [x] 2.3 Add service logic for bulk grid saves that upserts positive values and deletes blank/zero values.
- [x] 2.4 Add planned-to-actual copy service that creates or updates empty daily work logs and skips dates with existing allocations.
- [x] 2.5 Add service tests for validation errors, lock rejection, assignment rejection, blank/zero deletion, and copy idempotency.

## 3. Daily Plan Routes

- [x] 3.1 Add daily allocation planning loader for selected month, selected member, assigned projects, monthly plan totals, daily plan rows, and lock state.
- [x] 3.2 Add daily allocation planning action for bulk save with member/admin permission handling.
- [x] 3.3 Add daily allocation planning action for planned-to-actual copy with skip/copy summary feedback.
- [x] 3.4 Add route tests for member self-edit, admin selected-member edit, non-admin member isolation, unassigned project rejection, and locked month rejection.

## 4. Horizontal Planning UI

- [x] 4.1 Add navigation entry or workflow link for `日別予定工数入力` according to role.
- [x] 4.2 Implement target month and admin target member controls.
- [x] 4.3 Implement monthly summary cards for daily total, monthly total, and difference.
- [x] 4.4 Implement project-column selection using monthly-plan projects, existing daily-plan projects, and addable assigned projects.
- [x] 4.5 Implement date-by-project planned-hours grid with blank/zero-as-delete guidance and daily row totals.
- [x] 4.6 Implement mobile-safe layout through horizontal scrolling or compact per-day fallback.
- [x] 4.7 Implement copy-to-actual button and result summary.

## 5. Reporting And Existing Workflow Boundaries

- [x] 5.1 Keep existing planned-versus-actual report sourced from monthly plans and add/adjust tests to guard this behavior.
- [x] 5.2 Ensure copied actual allocations continue to appear in existing effort and planned-versus-actual reports as actuals.
- [x] 5.3 Ensure daily plans do not create, update, delete, or link monthly plan rows.

## 6. Verification

- [x] 6.1 Run OpenSpec validation for `add-daily-allocation-plans`.
- [x] 6.2 Run targeted repository and route tests for daily allocation plans.
- [x] 6.3 Run full typecheck, lint, test, and build.
- [x] 6.4 Smoke test daily plan save, blank/zero deletion, admin member selection, and planned-to-actual copy on local demo data.

## 7. Effort Workflow UI Clarity

- [x] 7.1 Rename navigation and page copy to distinguish actual effort entry from planned effort entry.
- [x] 7.2 Rename actual effort buttons and table labels so total working hours and project-level actuals are explicit.
- [x] 7.3 Move copy-to-actual into a separate daily planning card and explain that saved plans are copied.
- [x] 7.4 Group sidebar navigation by workflow sections for input, reports, projects, and administration.
- [x] 7.5 Standardize UI terminology around total working hours, planned effort, and actual effort.
- [x] 7.6 Run targeted tests after workflow label and button placement changes.
