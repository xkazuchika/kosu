## Why

kosu records daily working time, project allocations, member capacity, and monthly plans, but entering several project allocations requires repetitive saves and the system has no project-level effort budget to make those records actionable. This leaves teams with incomplete input and forces project budget, assignment, and remaining-effort decisions back into spreadsheets.

## What Changes

- Add an optional project-wide effort budget in hours, separate from the existing labor-cost budget in yen.
- Show project effort budget, member-plan allocation, cumulative actual effort, unallocated budget, remaining effort, and consumption rate together.
- Compare member monthly plans with the project effort budget and warn when planned or actual effort exceeds it without blocking ordinary entry.
- Redesign daily actual entry as a single editable allocation form with multiple add/remove rows, project-scoped task choices, live allocated and remaining totals, and one save.
- Offer fast starting points from the selected date's daily plan and the most recent usable workday, while preserving explicit user review before saving.
- Add a weekly actual-entry grid so repeated project/task combinations can be entered across several days without reopening each date.
- Keep actual total working hours variable by date; completion means project allocations equal that day's actual working hours rather than a fixed eight-hour day.
- Keep financial fields administrator-only and keep project budget context on member entry screens limited to non-financial hour information.

## Capabilities

### New Capabilities

- `project-effort-control`: Project-wide effort budgets and derived planned, actual, unallocated, remaining, and consumption indicators.

### Modified Capabilities

- `work-items`: Projects gain an optional administrator-managed effort budget in hours.
- `monthly-plans`: Member monthly allocations are compared with the project-wide effort budget and expose project allocation context.
- `time-entries`: Daily entry becomes a live multi-row allocation workflow and gains weekly bulk actual entry and reusable starting points.

## Impact

- Adds a nullable effort-budget column to projects and a reversible Drizzle migration.
- Changes project create/edit routes, project reports, monthly planning views, and daily/monthly work-log entry routes.
- Adds client-side state for live entry totals and dynamic rows while retaining server-side authorization, validation, monthly-close protection, and atomic persistence.
- Adds service/repository aggregation for project-wide planned and actual effort; no new external service or dependency is required.
- Existing projects remain valid without an effort budget, and internal or non-billable projects are not required to define one.
