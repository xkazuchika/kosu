## Why

Several accepted write paths can persist invalid business values, and a cleared daily work log cannot be entered again because logical deletion conflicts with the member/date uniqueness constraint. These defects can interrupt routine entry or corrupt effort and direct-labor reporting, so they should be fixed before adding more workflow features.

## What Changes

- Make zero-hour clearing reversible by reactivating or safely replacing a logically deleted daily work log when the same member and date are entered again.
- Validate real calendar dates consistently across daily, weekly, monthly-bulk, and daily-plan write paths.
- Limit daily total working hours, individual daily allocation values, and the combined daily allocation total to at most 24 hours while retaining the existing warning-based allocation-balance behavior within that bound.
- Accept member hourly cost rates only when empty or a non-negative safe integer amount in yen, consistently across forms and CSV import.
- Apply the same active-member, active-project, assignment, boolean, and reference validation to CSV imports that interactive workflows enforce.
- Enforce at most one active assignment per member/project pair, including direct, concurrent, and imported writes, preserve assignment history, and update the existing active assignment when its role changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `time-entries`: Add calendar-date and 24-hour validation and guarantee that a cleared day can be entered again.
- `team-members`: Define the valid domain for administrator-managed hourly cost rates.
- `data-import-export`: Require CSV preview and commit to enforce the same domain and lifecycle rules as interactive writes.
- `work-items`: Guarantee one active assignment per member/project and validate active assignment targets on every write path.

## Impact

- Affects daily and weekly effort services, monthly bulk entry, daily allocation plans, member create/edit flows, import validation and commit, assignment repositories, and related route/service/repository tests.
- Requires a SQLite migration or equivalent repository strategy for the active-assignment invariant and a compatibility-safe strategy for existing duplicate assignments.
- Does not change the 0.25-hour increment, warning-based allocation balance, historical assignment visibility, or financial-report scope.
