## Context

See proposal.md for motivation. The current schema already separates daily total working time (`daily_work_logs`), project/task allocations (`effort_allocations`), member monthly capacity, member-project monthly plans, and yen-denominated project financial baselines. Daily entry is server-rendered, provides one blank allocation row, and persists deletions separately. Monthly plans and actual allocations already capture hourly-cost-rate snapshots. Monthly close protection must remain effective for every mutation path.

## Goals / Non-Goals

**Goals:**

- Complete the hour-management chain from project effort budget through member plans to actual consumption.
- Make one-day and one-week actual allocation practical without weakening validation, authorization, cost snapshots, or close protection.
- Derive balances from existing plans and allocations instead of creating a second ledger that can drift.
- Preserve existing projects and historical entries through a nullable additive migration.

**Non-Goals:**

- Attendance clock-in/out, breaks, overtime approval, payroll, billing, or invoice generation.
- Mandatory budgets for internal work, hard blocking when a budget is exceeded, or automatic monetary valuation of unassigned hours.
- Timers, desktop activity tracking, calendar integrations, forecasting scenarios, and skills-based resource scheduling.
- Changing daily plans into actuals without explicit review and save by the member.

## Decisions

### Store one project-wide effort budget

Add nullable `projects.effortBudgetHours` as a real value validated in non-negative 0.25-hour increments. A null value means "not managed" and remains distinct from zero. The value covers the life of the project; monthly and member distribution continues to use existing monthly plans.

Alternative: create monthly project-budget rows. This would duplicate the existing member-month plan hierarchy and make project-wide remaining effort harder to explain. A single baseline plus derived monthly allocation is sufficient for this scope.

### Derive planned and actual balances

Project planned hours are the sum of active monthly-plan rows across all months. Actual hours are the sum of non-deleted effort allocations across all dates. Unallocated hours equal budget minus plans; remaining actual hours equal budget minus actuals. Negative values are retained and displayed as overages. Consumption is returned only for a positive budget.

Alternative: update counters whenever plans or actuals change. Stored counters would require repair paths for imports, reopening, and historical corrections. Query-derived totals keep one source of truth and are appropriate for the intended small-team SQLite deployment.

### Keep hour visibility separate from financial visibility

Administrators receive project hour indicators and existing cost indicators. Members may receive only their own monthly planned and actual hour context for assigned projects. Repository/service return types will provide explicitly masked member projections so adding the effort budget does not accidentally expose cost rates or financial baselines.

### Use a client-side draft with one server transaction

Extract the daily allocation editor into a stateful React component initialized from loader data or returned action data. Rows use stable client keys and optional persisted allocation IDs. Project changes clear incompatible tasks, and the task list is filtered in the browser from the already-authorized task set. Totals are calculated from the draft for immediate feedback.

The server reparses and validates the complete final row set, confirms ownership of persisted IDs, checks project/task eligibility, applies deletions and upserts, and updates the daily work log in one transaction. Client validation is convenience only.

Alternative: save each cell or row immediately. That increases requests, creates transient unbalanced states, and makes rollback and protected-month behavior harder to reason about.

### Starting points create drafts rather than records

Daily-plan and recent-workday actions return candidate rows to the editor without writing. Recent-workday lookup scans backward for the closest earlier date containing at least one currently usable allocation rather than using the previous calendar date. The user reviews the proposed total and rows and performs the normal atomic save.

### Add a Monday-to-Sunday weekly grid

Add `/work-logs/week` with a selected ISO date resolved to its Monday-to-Sunday interval. A row represents project, optional task, and optional note; date cells contain hours. Existing allocations retain per-date IDs behind the draft so edits and removals are explicit. Daily total working hours are editable per date and remain independent of an eight-hour assumption.

The server validates all changed dates first, checks every affected month is open, then applies the complete week in one database transaction. Unchanged historical allocations that cannot be newly selected remain preservable, following the daily-entry rules.

Alternative: extend the existing monthly total-hours table with project columns. A month-by-project matrix becomes too wide and still lacks task/note semantics; a focused seven-day grid keeps the interaction manageable.

### Treat budget overage as a warning

Project effort budgets guide planning and review. Saving a valid monthly plan or actual entry remains allowed when it exceeds the budget, and the resulting negative balance is visible. This matches the existing handling of allocation variance and avoids blocking legitimate overtime or necessary project completion work.

## Risks / Trade-offs

- [Whole-project aggregation may become slower as history grows] → Add project/date indexes only if query evidence requires them; current indexes already cover project access and the deployment target is single-instance SQLite.
- [Weekly rows can become wide on mobile] → Keep date cells horizontally scrollable with sticky project/task context and retain daily entry as the mobile-first path.
- [Similar allocations may be hard to match across dates] → Use persisted allocation IDs per cell and use the full project/task/note tuple only when grouping display rows.
- [Budget terminology may be confused with yen budget] → Label fields and metrics explicitly as `工数予算（時間）` and `人件費予算（円）`.
- [Draft suggestions may be mistaken for saved data] → Mark populated values as an unsaved draft and require the ordinary save action.
- [Large all-or-nothing weekly submissions can reject unrelated valid days] → Identify the exact failing date and preserve submitted values so correction does not require re-entry.

## Migration Plan

1. Add the nullable effort-budget column with no backfill; existing rows remain null.
2. Deploy repository validation and derived project-effort services before exposing new controls.
3. Add project budget fields and read-only indicators, then add the daily editor and weekly route.
4. Run migrations, foreign-key checks, unit/route tests, typecheck, lint, build, and focused browser coverage.
5. Roll back application code if needed while leaving the additive nullable column in place; no destructive data reversal is required.
