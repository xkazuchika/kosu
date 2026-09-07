## 1. Project Effort Budget Data

- [x] 1.1 Add nullable project effort-budget hours to the Drizzle schema and generated migration, and verify migration and schema tests preserve existing projects with a null value.
- [x] 1.2 Extend project repository inputs and project create/edit validation for optional non-negative quarter-hour budgets, and verify repository and route tests cover valid, empty, negative, and non-quarter-hour values.
- [x] 1.3 Implement project effort aggregation for all-month planned hours, cumulative actual hours, balances, overages, and zero-budget handling, and verify focused service tests cover each calculation.
- [x] 1.4 Add administrator project effort overview UI with clearly separated hour and yen budgets, and verify route tests cover budget-present, missing-budget, and over-budget states.

## 2. Planning and Member Context

- [x] 2.1 Add whole-project effort-budget context and non-blocking over-budget warnings to administrator monthly planning, and verify plan route tests confirm valid over-budget plans still save.
- [x] 2.2 Add selected-month planned, actual, and balance hours to the member monthly-plan view, and verify response tests confirm other members' plans and all financial fields remain hidden.
- [x] 2.3 Add concise own-plan progress to eligible projects in actual-entry loader data, and verify authorization tests confirm member responses contain hour context only.

## 3. Daily Actual Entry

- [x] 3.1 Extract an atomic daily-entry service that validates the complete submitted allocation set and applies work-log updates, allocation upserts, and removals in one transaction; verify service tests cover rollback, ownership, project/task eligibility, and close protection.
- [x] 3.2 Replace the server-only daily allocation table with a stateful multi-row draft editor supporting add/remove rows, project-scoped tasks, and retained submitted values after errors; verify component tests cover row operations and task filtering.
- [x] 3.3 Calculate allocated, remaining, and overallocated hours live from the draft and add a per-row action to assign all remaining time; verify component tests cover 5-hour, 8-hour, 9.5-hour, underallocated, balanced, and overallocated drafts.
- [x] 3.4 Implement unsaved starting-point drafts from the selected date's daily plan and nearest earlier usable workday, and verify route/service tests cover skipped empty days, ineligible historical rows, existing-target protection, and no-write behavior.
- [x] 3.5 Update daily-entry navigation and success/error feedback for the unified save flow, and verify the daily route tests cover multi-project creation, edit, removal, and server-error draft preservation.

## 4. Weekly Actual Entry

- [x] 4.1 Add week date utilities and a weekly entry read model that groups persisted allocations by project, task, and note while retaining per-date IDs; verify unit tests cover Monday-to-Sunday ranges including month boundaries.
- [x] 4.2 Implement atomic weekly validation and persistence across all changed dates, and verify service tests cover multi-day save, rollback on one invalid date, preserved historical rows, and protected-month rejection.
- [x] 4.3 Add the `/work-logs/week` route and responsive weekly grid with editable daily totals, reusable allocation rows, live per-day balances, and direct daily/weekly navigation; verify route and component tests cover loading and editing a representative week.
- [x] 4.4 Add the weekly entry point to the primary navigation and dashboard workflow, and verify navigation tests and mobile layout assertions keep daily entry readily accessible.

## 5. Integration and Release Verification

- [x] 5.1 Update user guide, business flow, README scope, and demo data for project effort budgets and daily/weekly actual entry, and verify documented labels and routes match the implementation.
- [x] 5.2 Extend Playwright smoke coverage through project budget setup, multi-row daily save, and weekly entry while checking for browser errors.
- [x] 5.3 Run OpenSpec strict validation, database migration and integrity checks, Vitest, typecheck, ESLint, production build, and Playwright; record and resolve any failures before marking the change complete.
