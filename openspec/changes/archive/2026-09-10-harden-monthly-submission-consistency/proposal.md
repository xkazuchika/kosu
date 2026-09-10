## Why

The monthly effort submission feature matches its intended workflow, but the post-implementation review found one main-spec ownership error and two integrity boundaries that rely on application convention rather than transactional or database enforcement. Tightening these points now prevents the close state and submission state from diverging under concurrent writers or malformed persisted data.

## What Changes

- Restore the existing dashboard workflow scenarios to their original requirement while keeping monthly submission scenarios under their dedicated requirement.
- Require protected-month validation to run inside the same transaction as every actual-effort mutation and submission invalidation.
- Constrain persisted monthly submission month and status values so malformed records are rejected by SQLite as well as by application validation.
- Add regression coverage for the corrected specification structure, transactional lock rechecks, database constraints, and upgraded migration behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `period-locking`: Require the close-state guard to be checked transactionally with actual-effort mutations.
- `monthly-effort-submission`: Require persisted submission month and status values to remain within the supported domain.

## Impact

- Main dashboard specification plus delta specifications for period locking and monthly effort submission.
- Actual-effort mutation paths in monthly bulk entry, previous-day copy, and daily-plan-to-actual copy.
- Drizzle schema and a forward SQLite migration for monthly submission constraints.
- Route, service, schema, and migration regression tests; release documentation if migration notes need clarification.
