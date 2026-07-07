## Context

Kosu already has daily work logs, daily allocations, monthly capacities, and monthly plans. The current daily workflow is accurate but slow when users need to fill or correct multiple days. The current planned-versus-actual route exists as a preview, but v0.2 should make it a supported workflow tied to the existing monthly planning model.

The main constraint is to keep Kosu lightweight and self-hosted. This change should avoid new dependencies and avoid introducing a day-level planning model unless there is a stronger product need later.

## Goals / Non-Goals

**Goals:**

- Add a calendar-like monthly work-log view for fast review and bulk daily total entry.
- Keep the existing daily detail screen as the place for project/task allocation details.
- Let administrators use the same monthly entry flow for a selected member.
- Use existing monthly capacities and monthly plans as the v0.2 planning source.
- Promote planned-versus-actual reporting to supported v0.2 behavior and primary navigation where appropriate.

**Non-Goals:**

- Add day-level planned effort.
- Add automatic timers, attendance/payroll, approval workflows, or Gantt-style planning.
- Add financial reporting, revenue, budget, gross profit, or profitability analysis.
- Replace the daily detail allocation workflow.

## Decisions

### Use existing tables for v0.2 planning and bulk entry

Monthly bulk entry will create or update `daily_work_logs` rows and will not introduce a new calendar table. Planned-versus-actual will read `monthly_capacities`, `monthly_plans`, `daily_work_logs`, and `effort_allocations`.

Alternative considered: add day-level planned-effort rows. This would support finer planning but adds more setup burden and makes v0.2 feel heavier than the current lightweight OSS direction.

### Keep allocation details on the daily screen

The monthly view will focus on date, weekday, total hours, allocation total, variance, lock state, and a detail link. Editing multiple allocation rows inline would make the monthly screen complex and hard to use on mobile.

Alternative considered: full spreadsheet-style allocation editing. This is powerful but significantly increases validation, keyboard interaction, and layout complexity.

### Add a dedicated monthly entry route

Use a route such as `/work-logs/month?month=YYYY-MM&memberId=...` rather than overloading `/work-logs`. The existing `/work-logs` list can link into the monthly view while preserving the current route for historical daily logs.

Alternative considered: replace `/work-logs` with the monthly view. Keeping both reduces regression risk and preserves the recently improved daily/list workflow.

### Promote planned-versus-actual without financial scope

The planned-versus-actual report should show capacity, planned hours, actual allocated hours, unallocated capacity, overplanned hours, and variance by member/project/month. It must not include cost, revenue, budget, gross profit, or profitability.

Alternative considered: include planned/actual cost because cost snapshots already exist. This is intentionally deferred to keep v0.2 focused on effort management rather than financial reporting.

## Risks / Trade-offs

- Bulk saving many days could overwrite user edits unintentionally -> Only submit explicit rows included in the form and keep allocation rows untouched.
- Users may expect monthly total hours to auto-distribute to projects -> Keep copy clear that monthly bulk entry edits daily total hours only; project/task allocation remains on daily detail.
- Planned-versus-actual may look incomplete when monthly plans are missing -> Show empty states and guidance linking to monthly plans.
- Locked months can be confusing in bulk entry -> Render locked rows as read-only for non-administrators and show a lock warning at month level.
