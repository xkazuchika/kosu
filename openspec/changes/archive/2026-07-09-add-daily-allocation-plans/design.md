## Context

v0.3 established monthly planned effort as the supported monthly planning layer. That layer is intentionally a monthly total: it answers how much planned effort a member is expected to spend on a project during a month. The next planning gap is operational scheduling: when that effort is expected to happen.

Daily allocation plans fill that gap. The core question is:

```text
When is which member planned to work on which project, and for how many hours?
```

This change should introduce that daily planning layer without expanding into task planning, cost accounting, financial reporting, attendance, payroll, or full scheduling software.

## Goals / Non-Goals

**Goals:**

- Add project-level daily planned effort by member, project, and date.
- Make daily plans fast to enter for a whole month using a horizontal grid.
- Treat daily plans as the practical base for planned-to-actual copying.
- Keep monthly plans as monthly totals, compared to daily plans by aggregation only.
- Keep validation strict enough to prevent impossible daily schedules.
- Preserve current actual effort entry behavior and task-optional actual allocations.
- Keep the feature lightweight and self-hosted-team friendly.

**Non-Goals:**

- Add task-level daily planning.
- Add `monthlyPlanId` links or automatic synchronization between monthly plans and daily plans.
- Add planned cost, actual cost, gross profit, revenue, budget, or financial reports.
- Add `workspaceId` or multi-tenant workspace scoping.
- Change the existing planned-versus-actual report to use daily plans as its planned source.
- Add attendance, payroll, leave, work-rule calculation, approvals, or ERP workflow.
- Add external project-management or ticket-system synchronization.

## Conceptual Model

### Monthly Plans

Monthly plans remain monthly totals. They represent high-level planned effort for a member and project in a month.

```text
Monthly plan = who is planned to spend how many total hours on which project during the month
```

Monthly plans are useful for rough planning, staffing, comparison, and future budget/cost reporting. They do not control daily plan rows.

### Daily Allocation Plans

Daily allocation plans are the operational planning base. They represent concrete project allocation by date.

```text
Daily plan = on which date a member is planned to spend how many hours on which project
```

Daily plans can differ from monthly plans. This is expected. The system should show the difference, not try to automatically reconcile it.

### Relationship Between Monthly And Daily Plans

Monthly plans and daily plans are related by shared dimensions, not by direct foreign keys.

```text
shared dimensions: memberId + projectId + month(planDate)
```

The system compares them by aggregation:

```text
monthly planned hours = sum(monthly_plans.plannedHours)
daily planned hours = sum(daily_allocation_plans.plannedHours for dates in month)
difference = daily planned hours - monthly planned hours
```

No automatic sync is performed:

- Updating a monthly plan does not update daily plans.
- Updating daily plans does not update monthly plans.
- Deleting a monthly plan does not delete daily plans.
- Deleting daily plans does not delete monthly plans.

Monthly plans can still provide useful default project columns in the daily plan UI. That is display/input guidance only, not a stored relationship.

## Data Model

### Table

Add `daily_allocation_plans`.

```text
daily_allocation_plans
- id text primary key
- memberId text not null references members(id)
- projectId text not null references projects(id)
- planDate text not null -- YYYY-MM-DD
- plannedHours real not null
- createdAt text not null
- updatedAt text not null
```

### Unique Constraint

Use one row per member, date, and project.

```text
unique(memberId, planDate, projectId)
```

This keeps the horizontal grid predictable: each cell maps to at most one row.

### Fields Intentionally Excluded

`taskId` is excluded.

Reason: task-level planning increases input burden, widens the grid, and risks duplicating ticket/project-management tools. Actual allocations may continue to support optional tasks, but daily plans are project-level only.

`monthlyPlanId` is excluded.

Reason: monthly plans are monthly totals and daily plans are operational plans. Direct links would require complicated synchronization rules that are not needed for the current workflow.

`assignmentRole` is excluded.

Reason: assignment role can be read from project assignments or monthly plans for display if needed. Storing it on daily plans creates ambiguity when roles change and is not needed for project/day/hour planning.

`hourlyCostRateSnapshot` is excluded for this change.

Reason: it is useful later for planned cost, but this change does not display planned cost. Adding it now would force cost-snapshot semantics before planned-cost reporting is designed. A future financial change can add a planned-cost snapshot field with explicit administrator-only behavior.

`workspaceId` is excluded.

Reason: the product is currently single-workspace/self-hosted. Multi-tenant workspace scoping would add schema and permission complexity without a concrete need.

## Validation Rules

### Cell Semantics

The horizontal grid uses sparse storage.

```text
empty cell = no plan
0 = no plan
positive value = plan exists
```

Save behavior:

```text
empty or 0:
- if a row exists, delete it
- if no row exists, do nothing

positive value:
- create or update the daily plan row
```

The database should not store zero-hour daily plan rows.

### Planned Hours

For positive values:

- planned hours MUST be greater than `0`.
- planned hours MUST use 0.25h increments.
- negative values MUST be rejected.
- non-numeric values MUST be rejected.

### Daily Total Limit

The total planned hours for a member on a date MUST be less than or equal to `24`.

This validation applies after interpreting empty and `0` cells as deletions. It prevents impossible daily totals while avoiding any attendance or work-rule logic.

The system does not enforce a standard workday such as 8h. That would be attendance/work-rule scope and is intentionally out of this change.

### Date And Month Validation

- `month` query values MUST be valid `YYYY-MM` values.
- `planDate` values MUST be valid `YYYY-MM-DD` dates within the selected month.
- Bulk saves MUST reject rows outside the selected month.

### Project Validation

Daily plans can only reference active projects assigned to the target member.

- Members can only plan against their own active assigned projects.
- Administrators can plan against active projects assigned to the selected target member.
- Archived projects cannot receive new daily plan rows.
- Existing historical rows for archived projects may remain visible if a project is archived later, but editing them into active plan rows should be blocked unless the project is active and assigned.

## Permissions

### Member

Members can:

- view their own daily allocation plans.
- create, update, and delete their own daily allocation plans for unlocked months.
- copy their own daily plans to actuals for unlocked months when copy rules allow it.

Members cannot:
- select another member.
- create daily plans for unassigned projects.
- edit locked months.
- copy locked months to actuals.

### Administrator

Administrators can:

- select a target member.
- view, create, update, and delete daily allocation plans for any member.
- copy daily plans to actuals for a selected member when the month is unlocked.

Administrators cannot:

- create daily plans for projects not assigned to the selected member.
- edit or copy locked months in this change.

Admins must unlock the month first. This matches the safer interpretation of lock semantics and avoids introducing special administrative bypass behavior for planned-to-actual copy.

## Lock Handling

Locked months are read-only for daily plans.

When a month is locked:

- daily plan grid inputs are disabled or non-submittable.
- daily plan bulk save is rejected server-side.
- copy-to-actual is rejected server-side.
- the UI shows a clear locked warning.

This applies to both members and administrators.

## UI Design

### Route Shape

Preferred route:

```text
/daily-plans?month=YYYY-MM
/daily-plans?month=YYYY-MM&memberId=<id> -- admin only
```

The exact route name can be adjusted during implementation if it fits existing route naming better, but the user-facing label should be Japanese-first and clear, such as `日別予定工数入力`.

### Page Structure

The page should include:

- title and short explanation.
- target month selector.
- target member selector for administrators.
- navigation links to monthly plans, monthly work-log entry, and planned-versus-actual.
- summary cards for daily plan total, monthly plan total, and difference.
- project-column selector for adding assigned projects not already visible.
- horizontal grid for daily plan entry.
- bulk save action.
- copy-to-actual action with skip summary.

### Horizontal Grid

The main input uses a spreadsheet-like layout:

```text
rows = dates in the selected month
columns = projects
cells = planned hours
```

Default columns:

- projects that have monthly plans for the target member and month.
- projects that already have daily plans for the target member and month.

Additional columns:

- administrators and members can add any active assigned project for the target member.
- adding a column does not create data until positive cell values are saved.

Column labels should show project names. Codes may be added if already commonly shown elsewhere, but avoid making cells too wide.

### Cell Behavior

Each cell corresponds to one potential daily plan row.

- blank input means no plan.
- `0` means no plan.
- positive valid value means upsert.
- invalid values keep the page on the same state with a validation error.

Use right-aligned number inputs with `step="0.25"` where practical.

### Row Summary

Each date row should show:

- date.
- weekday.
- daily planned total.
- status when total exceeds 24h.

The UI does not need to compare against daily capacity in this change.

### Monthly Summary

At minimum, show:

- daily plan total for the selected month.
- monthly plan total for the same member/month.
- difference: daily total minus monthly total.

The difference is informational. It should not block saving.

### Mobile Behavior

The desktop grid can horizontally scroll. For mobile, the UI must remain usable even if it cannot look like a full spreadsheet.

Acceptable mobile fallback:

- horizontal scroll with sticky date column, if feasible.
- compact per-day sections listing project inputs vertically.

Implementation should choose the smaller reliable option. The requirement is usability, not a perfect spreadsheet on small screens.

## Copy To Actuals

### Purpose

Copying turns daily plans into actual daily work logs and effort allocations. This reduces double entry when the plan matched reality.

### Copy Eligibility

For each date in the selected month:

```text
daily work log does not exist -> copy allowed
daily work log exists and has 0 effort allocations -> copy allowed
daily work log exists and has 1+ effort allocations -> skip
```

Copy eligibility is based on actual effort allocations, not on the existence of a daily work log.

### Copy Behavior

For each eligible date with at least one positive daily plan row:

```text
if daily work log does not exist:
- create daily work log
- set totalWorkingHours to sum(daily planned hours for that date)
- create effort allocations for each daily plan row

if daily work log exists and has 0 allocations:
- update totalWorkingHours to sum(daily planned hours for that date)
- create effort allocations for each daily plan row
```

For skipped dates:

```text
if daily work log has existing allocations:
- do not change totalWorkingHours
- do not create allocations
- report the date as skipped
```

### Actual Allocation Details

Created effort allocations should:

- reference the target member's daily work log.
- reference the daily plan project.
- set allocated hours from planned hours.
- leave task empty.
- leave note empty or use a minimal system note only if existing conventions require it.
- capture actual allocation cost-rate snapshots using the existing actual allocation behavior.

Daily plans do not store cost snapshots, but copied actual allocations still use the existing actual allocation snapshot logic.

### Copy Summary

After copy, the UI should show a clear result summary:

- number of dates copied.
- number of allocations created.
- number of dates skipped because actual allocations already existed.
- number of dates skipped because no daily plan existed.

This summary can be simple route action feedback; it does not require persistent audit records.

### Copy Idempotency

The operation should be safe to run repeatedly.

After the first successful copy, copied dates now have actual allocations. A second copy should skip those dates rather than duplicate allocations.

## Reporting And Existing Planned-Versus-Actual

The existing planned-versus-actual report remains monthly-plan based in this change.

Reason: replacing the report's planned source with daily plans would change report semantics and deserves a separate decision. Daily plans and monthly plans can differ intentionally.

This change should provide daily-plan-specific summaries on the daily plan page:

- daily plan total by month.
- monthly plan total for comparison.
- difference between daily and monthly planned totals.

Future changes may add a report that compares daily plans to actual allocations by date, but that is not part of this change.

## Repository And Service Design

Add repository functions for daily allocation plans:

- list daily plans by member and month.
- list daily plans by member and date.
- find daily plan by member/date/project.
- upsert daily plan.
- delete daily plan.
- delete daily plan when a cell is blank or zero.
- aggregate daily plan totals by project for a month.
- aggregate daily plan totals by date for a month.

Add service-level functions where business rules are more complex:

- validate bulk grid input.
- enforce active assignment/project rules.
- enforce daily total <= 24h.
- copy eligible daily plans to actuals.

Keep copy-to-actual logic out of the route component as much as practical. The route action should parse form data, call a service/repository operation, and return feedback.

## Migration Design

Add a Drizzle migration for `daily_allocation_plans`.

The table should use existing conventions for IDs and timestamps. No backfill is needed.

Existing monthly plans and actual effort allocations remain unchanged.

## Test Strategy

### Repository Tests

- creates a daily plan row.
- updates an existing row for the same member/date/project.
- deletes a row when requested.
- rejects or prevents duplicate rows via unique constraint.
- lists plans by member and month.
- aggregates by date and project.

### Route/Action Tests

- member saves own daily plan grid.
- member cannot save another member's grid.
- administrator saves a selected member's grid.
- unassigned project is rejected.
- archived project is rejected for new plan input.
- blank/zero cell deletes an existing row.
- positive cell upserts a row.
- negative value is rejected.
- non-quarter-hour value is rejected.
- daily total over 24h is rejected.
- locked month rejects save for member and administrator.

### Copy-To-Actual Tests

- creates daily work log and allocations when no work log exists.
- updates existing empty daily work log totalWorkingHours and creates allocations.
- skips dates that already have actual allocations.
- does not duplicate allocations on repeated copy.
- rejects copy for locked month.
- rejects copy for another member when requester is not admin.
- created actual allocations have no task and use the planned project/hours.

### UI/Component Tests

- page exposes target month selector.
- administrator sees member selector.
- member does not see member selector.
- monthly plan total, daily plan total, and difference are shown.
- project columns include monthly-plan projects and existing daily-plan projects.

## Risks / Trade-offs

- Horizontal grids can become wide when a member has many projects -> use horizontal scroll and keep default columns limited to relevant projects.
- Blank/zero-as-delete is convenient but can surprise users -> copy should clearly say empty or 0 means no plan.
- Monthly and daily plans can diverge -> show the difference clearly and avoid automatic sync.
- Copy-to-actual can overwrite expected total working hours for empty work logs -> only update when actual allocations are zero, and report what happened.
- Excluding task planning simplifies input but limits detailed planning -> keep actual allocation tasks optional and revisit task-level planning only if users need it.

## Open Questions

- Exact route label: `日別予定工数入力` aligns with the planned effort terminology used across the UI.
- Mobile fallback should be chosen during implementation after seeing how the existing table/card components behave.
- Copy summary can be transient action feedback initially; persistent copy history is not required.
