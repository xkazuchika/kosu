## Context

See `proposal.md` for motivation. Validation is currently distributed across route actions and services. Date inputs commonly use a shape-only regular expression, member hourly rates use direct numeric conversion, and CSV validation implements a weaker subset of interactive rules. Daily work logs use logical deletion together with an unconditional member/date unique constraint, while active project assignments have no database uniqueness constraint.

## Goals / Non-Goals

**Goals:**

- Centralize reusable domain validation so interactive and CSV paths agree.
- Repair cleared-day re-entry without losing historical allocation rows.
- Put the active-assignment invariant at both service and database boundaries.
- Preserve current atomic write behavior and monthly-close protection.

**Non-Goals:**

- Changing quarter-hour granularity or making allocation balance a hard equality rule.
- Adding attendance, holidays, approvals, or new financial calculations.
- Retrofitting every existing `updatedAt` field or building a general audit log.

## Decisions

### Use strict shared scalar validators

Add a strict calendar-date validator that checks `YYYY-MM-DD` shape and exact UTC round-trip rather than accepting JavaScript date normalization. Add explicit daily-hour helpers for positive quarter-hours at or below 24 and a safe non-negative integer-yen parser for hourly rates. Routes may keep HTML constraints for guidance, but all server write paths use the shared validators.

Alternative considered: depend on `input` attributes and route-local checks. This does not protect crafted requests, service calls, CSV imports, or future routes and is the source of the current inconsistency.

### Enforce a 24-hour aggregate without requiring exact balance

Validate total working hours, each allocation, and the submitted active allocation sum independently against 24 hours. Values within the limit may remain under- or overallocated relative to total working hours, preserving the current warning and correction workflow.

Alternative considered: reject every imbalance. That would be a larger workflow change and conflict with the existing ability to save incomplete work before resolving it.

### Reactivate the existing cleared work-log row

Repository support will look up a member/date row including logically deleted records. Creation for a cleared date will update that row with new total hours, clear `deletedAt`, and leave all logically deleted allocations deleted. The reactivation happens inside the same transaction as validation and allocation writes.

Alternative considered: replace the unconditional unique constraint with a partial unique index and insert a new work-log row. Reusing the stable row avoids multiple identities for one member/date and preserves existing foreign-key relationships without exposing deleted allocations.

### Centralize import eligibility and revalidate at commit

Import preview will call shared validators for scalar values and relationship eligibility. Commit will rerun validation inside its existing all-or-nothing transaction rather than trusting an earlier preview. Project CSV columns will add `effortBudgetHours` while retaining backward compatibility for older files through the template/header rules chosen by the current import format.

Alternative considered: validate only in preview. State can change between preview and commit, so preview-only enforcement cannot guarantee the stored result.

### Add a partial unique index for active assignments

Create a SQLite unique index on `(member_id, project_id)` where `removed_at IS NULL`. Application services will check active member/project eligibility and return a domain error before relying on the constraint. Role changes update the active row.

Before creating the index, migration SQL will group duplicate active assignments, retain the most recently assigned row using `assigned_at` and `id` as deterministic ordering, and set `removed_at` on other rows to the retained assignment timestamp. No assignment row is deleted.

Alternative considered: application-only duplicate checks. Concurrent or direct repository writes could still create duplicates.

## Risks / Trade-offs

- [Older project CSV files lack the new effort-budget column] -> Keep the new column optional on import so older header-based files remain valid, include it in newly downloaded templates and exports, and do not rely on positional fields.
- [Duplicate-assignment cleanup may retain a different role than an operator expected] -> Keep the newest assignment deterministically and preserve every other row as history for manual review.
- [Reactivated work logs retain their original creation timestamp] -> Treat identity continuity as intentional; set update metadata when reactivating and test that deleted allocations remain excluded.
- [A new 24-hour cap rejects previously accepted unrealistic values] -> Validate existing data before migration/release and report any outliers rather than rewriting them automatically.

## Migration Plan

1. Add shared validators and tests without changing stored data.
2. Add repository reactivation behavior and regression tests for clear-then-reenter through each entry path.
3. Normalize duplicate active assignments and create the partial unique index in a forward migration.
4. Apply shared validation to forms, services, imports, and project CSV round-tripping.
5. Run migration, foreign-key integrity, unit/route tests, typecheck, lint, build, and browser smoke against fresh and upgraded databases.

Rollback keeps all assignment and work-log rows. Older code ignores the added index, but rollback documentation must note that assignments normalized to removed history are not automatically made active again.
