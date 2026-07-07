## Why

Daily effort entry is currently optimized for one day at a time, but real users often enter or correct several days at once. v0.2 should reduce entry friction and make existing monthly plans useful by showing planned-versus-actual progress in the same workflow.

## What Changes

- Add a month-based bulk effort entry view where members and administrators can review a calendar-like list of daily work logs for a month.
- Allow quick creation or update of daily total working hours from the monthly view while keeping detailed project/task allocation on the existing daily entry screen.
- Preserve locked-period behavior so locked months remain read-only for non-administrators.
- Promote planned-versus-actual reporting from preview to a v0.2 supported capability using existing monthly capacity, monthly plans, daily logs, and effort allocations.
- Improve navigation and UI copy so monthly plans, monthly bulk entry, daily detail entry, and planned-versus-actual reports form one understandable workflow.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `time-entries`: Add monthly calendar-like bulk daily work-log entry and review.
- `monthly-plans`: Clarify that existing monthly plans are the v0.2 planning source used by planned-versus-actual views.
- `reports`: Promote planned-versus-actual reporting to supported v0.2 behavior.
- `ui-ux`: Add navigation and status requirements for the monthly bulk entry and planning/reporting workflow.

## Impact

- Affected routes: `app/routes/work-logs.tsx`, `app/routes/work-logs.$date.tsx`, new monthly work-log route, `app/routes/monthly-plans*.tsx`, and `app/routes/reports.planned-vs-actual.tsx`.
- Affected components: app shell navigation and existing table/form primitives.
- Data model: no new tables expected; use existing daily work logs, allocations, monthly capacities, and monthly plans.
- Tests: route tests for monthly bulk entry, locked-period handling, admin target-member behavior, and planned-versus-actual report visibility/calculation.
