## Why

kosu can calculate direct-labor cost and labor margin, but month-end review still depends on manual checks outside the system. The existing workspace-month lock also lacks completeness criteria, approval snapshots, and durable history, so a locked month does not prove that its project-cost figures were complete or what was later corrected.

## What Changes

- Replace the ambiguous project-by-project close with one administrator-controlled workspace monthly close containing project-level completeness rows.
- Add open, in-review, and approved lifecycle states; reopening returns the month to open and records a required reason as an append-only event.
- Define blocking completeness issues: unbalanced work logs, missing cost snapshots, and missing billable-project financial baselines when that project has activity.
- Treat zero-activity projects as valid and keep daily-versus-monthly plan differences as warnings rather than approval blockers.
- Persist an immutable project financial snapshot when a month is approved so later project, member-rate, or future-period changes do not rewrite the approved result.
- Add an explicit administrator correction flow for missing historical cost snapshots, requiring a rate and reason.
- Block both member and administrator mutations while a month is in review or approved; administrators must reopen the month before correcting it.
- Migrate existing locked months to in-review so they remain protected but are not falsely represented as financially approved.
- Keep external integrations, expenses, subcontractor costs, indirect-cost allocation, accounting exports, and invoicing out of scope.
- **BREAKING**: Administrators will no longer edit protected months directly; they must reopen the monthly close first.

## Capabilities

### New Capabilities

- `project-cost-closing`: Workspace monthly close, completeness checks, approval snapshots, and append-only review history.

### Modified Capabilities

- `project-financial-control`: Define blocking completeness rules and immutable approved financial snapshots.
- `period-locking`: Replace inconsistent administrator bypass behavior with the monthly close lifecycle and reasoned reopening.
- `time-entries`: Enforce in-review and approved month restrictions across every work-log mutation path.

## Impact

- Affected persistence: monthly close state, append-only close events, project financial snapshots, and a forward-only migration from legacy period locks.
- Affected routes and services: period management, project financial review, work logs, daily/monthly plans, capacities, CSV import commits, project financial inputs, and dashboard/report status.
- Affected authorization: all cost-relevant mutations use one shared monthly-close guard.
- Affected tests: migration compatibility, lifecycle transitions, transactional approval, snapshot immutability, alternate mutation routes, and legacy-lock behavior.
- No new third-party dependency or external service integration is required.
