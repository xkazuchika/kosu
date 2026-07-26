## Context

The current `period_locks` table protects an entire month, while project financial review derives live values from monthly plans, effort allocations, and mutable project baselines. A project-specific close cannot reliably own unallocated hours or a work log spanning multiple projects. It would also overlap the existing month lock and leave historical approved figures vulnerable to later project or cumulative-data changes.

## Goals / Non-Goals

**Goals:**

- Make one workspace month the unit of review and protection.
- Show project-level completeness and financial results inside that monthly close.
- Preserve approved figures and every lifecycle transition for audit.
- Make all mutation paths follow the same protection rule.

**Non-Goals:**

- Expenses, subcontractor costs, indirect-cost allocation, invoicing, accounting exports, or external integrations.
- Inferring expected work from missing rows; zero activity is valid.
- Automatically filling missing cost snapshots from the member's current rate.

## Decisions

### Monthly close is the single protection model

Create `monthly_cost_closes` with one row per `YYYY-MM` and status `open`, `in_review`, or `approved`. Missing rows behave as open. Entering in-review freezes all month-scoped member and administrator mutations; corrections require reopening to open.

Legacy locked `period_locks` rows migrate to in-review, preserving actor and timestamp where available. They remain protected but require an explicit completeness review before approval. The application stops using the legacy table after migration, while the table remains for rollback compatibility.

### Lifecycle events are append-only

Create `monthly_cost_close_events` for entered-review, approved, and reopened events. Each event stores actor, timestamp, prior status, next status, and optional reason. Reopening from in-review or approved requires a non-empty reason. `reopened` is an event, not a persistent status.

### Completeness has explicit blocking and warning rules

Blocking issues are:

- any daily work log in the month whose active allocation total differs from total working hours;
- monthly planned hours or actual allocations in the month with no hourly cost snapshot;
- historical actual allocations through the selected month with no cost snapshot when cumulative labor cost or margin is being approved;
- a billable project with planned or actual activity in the month but no contract revenue or labor cost budget.

Zero-activity projects and absent work logs are not issues. Daily-plan versus monthly-plan differences remain visible warnings because daily plans do not feed the financial calculation directly.

Missing snapshots are corrected only through an administrator action that records the explicit yen-per-hour rate and reason. The correction event is appended to close history.

### Approval is transactional and produces snapshots

Approval runs in one SQLite transaction: reload close state, recompute blocking issues, reject if any remain, insert one `monthly_cost_close_project_snapshots` row per project with activity or a financial baseline, append the approval event, then mark the close approved.

Each project snapshot stores project identity/type/archive state, contract revenue, labor budget, monthly planned cost, monthly actual cost, cumulative actual cost through month-end, budget consumption, remaining labor budget, and applicable labor gross-profit values. Approved-month views read these snapshots; open and in-review views use live calculations.

### One shared guard protects all write paths

A shared `requireOpenMonth` service replaces inconsistent administrator bypasses. It protects work-log totals, allocations, daily plans, monthly plans, member capacities, copy-plan-to-actual, CSV import commits, and any other month-scoped mutation.

Project baseline, archive, and member-rate edits remain possible because approved snapshots are immutable. They affect only live/open calculations and future approvals. Approved historical views continue reading their snapshots.

## Risks / Trade-offs

- [Workspace-level close blocks unrelated project corrections] → This matches the existing month-level lock and avoids ambiguous multi-project work-log ownership; reopening is explicit and audited.
- [Snapshot rows duplicate calculated values] → Duplication is intentional so approved results remain reproducible after later master-data changes.
- [Legacy locks are not automatically approved] → Migrating them to in-review preserves protection without making an unsupported financial-completeness claim.
- [Historical missing snapshots can block approval] → Provide an explicit, audited correction flow rather than silently applying current rates.

## Migration Plan

1. Add monthly close, event, and project snapshot tables.
2. Copy each legacy locked period into an in-review monthly close and append a migration event using preserved metadata when available.
3. Leave unlocked or absent legacy rows open without creating new rows.
4. Switch all read/write guards and period-management UI to monthly close state.
5. Deploy completeness review before allowing approval.
6. Roll back application code without dropping new tables; the untouched legacy period-lock table remains available to the previous release.

## Open Questions

None for the first implementation. External costs and integrations remain future changes.
