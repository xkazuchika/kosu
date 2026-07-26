## 1. Monthly Close Persistence And Migration

- [x] 1.1 Add monthly close, append-only event, and approved project snapshot schemas with unique month/project constraints and indexes.
- [x] 1.2 Generate a forward-only migration that maps active legacy locks to in-review, preserves available metadata, and leaves open months open.
- [x] 1.3 Add schema and migration tests for fresh databases, locked legacy databases, unlocked legacy databases, and rollback-compatible table preservation.

## 2. Lifecycle And Protection

- [x] 2.1 Add typed repositories for close state, events, and approved project snapshots.
- [x] 2.2 Implement administrator lifecycle transitions, required reopen reasons, and append-only event history.
- [x] 2.3 Implement one shared `requireOpenMonth` guard and replace inconsistent administrator bypass behavior.
- [x] 2.4 Apply the guard to daily/monthly work logs, allocations, daily plans, monthly plans, capacities, plan-to-actual copy, and CSV import commits.

## 3. Completeness And Corrections

- [x] 3.1 Implement stable blocking issue codes for unbalanced work logs, missing selected-month/historical cost snapshots, and missing active billable-project baselines.
- [x] 3.2 Implement non-blocking warnings for daily-versus-monthly plan differences and ensure zero activity is never treated as missing data.
- [x] 3.3 Add issue detail queries and correction links for member/date, plan/allocation, and project baseline problems.
- [x] 3.4 Add an administrator missing-cost correction action requiring an explicit rate and reason, with an append-only correction event.

## 4. Transactional Approval And Financial Snapshots

- [x] 4.1 Implement transactional approval that reloads state, recomputes blockers, writes project snapshots, appends the event, and changes status atomically.
- [x] 4.2 Snapshot project identity/type/archive state, baselines, selected-month planned/actual cost, cumulative cost through month-end, budget metrics, and applicable labor margins.
- [x] 4.3 Update financial review services to use approved snapshots for approved months and live calculations for open/in-review months.
- [x] 4.4 Add tests proving later project edits, member-rate edits, archive changes, and future actuals cannot alter approved financial views.

## 5. Monthly Close User Experience

- [x] 5.1 Replace period-lock management with an administrator monthly-close screen showing state, blockers, warnings, project rows, lifecycle actions, and history.
- [x] 5.2 Show consistent open/in-review/approved state and read-only guidance on work-log, planning, financial review, dashboard, and report surfaces.
- [x] 5.3 Add Japanese validation, protected-month, missing-cost correction, and reopen-reason messages.

## 6. Verification And Documentation

- [x] 6.1 Add service and route tests for permissions, lifecycle transitions, atomic rollback, alternate mutation paths, and correction history.
- [x] 6.2 Run full Vitest, migrations, typecheck, lint, production build, Playwright smoke, strict OpenSpec validation, and SQLite/Docker persistence smoke.
- [x] 6.3 Update README, user guide, and release checklist with monthly-close behavior, approved snapshot semantics, migration notes, and external-cost exclusions.
