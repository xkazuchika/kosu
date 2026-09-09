## Context

See `proposal.md` for motivation. Monthly close currently derives completeness from stored work logs, allocations, plans, project baselines, and cost snapshots. A member/month with no rows is indistinguishable from an intentionally completed zero-hour month. Existing close states protect all actual-effort writes once review starts, and historical installations may already contain in-review or approved months.

## Goals / Non-Goals

**Goals:**

- Add an explicit, auditable member/month completion declaration.
- Reuse existing monthly work-log review and close workflows instead of adding a separate approval product area.
- Prevent review from freezing a month before all required submissions are resolvable.
- Keep effort changes and submission invalidation atomic.

**Non-Goals:**

- Manager-by-manager approval, rejection, comments, reminders, or escalation.
- Attendance, leave, holiday, payroll, or expected-workday calculation.
- Locking a submitted member month independently of the workspace close.

## Decisions

### Store one current state row per member and month

Add `monthly_effort_submissions` with a unique `(member_id, month)` key and fields for `status`, submission actor/time, last invalidation actor/time, a legacy-migration marker, and timestamps. Absence of a row reads as draft. Submission upserts the row; actual-effort writes update submitted rows to draft and clear current submission metadata while retaining last invalidation metadata.

Alternative considered: infer completion from capacity or the presence of work logs. Capacity is optional planning context, and row presence cannot represent an intentional zero-hour month.

### Allow administrator submission on behalf of a member

Members may submit only themselves. Administrators may submit any required member after reviewing the selected member/month, including inactive members. The stored actor remains distinct from the target member so proxy submission is visible.

Alternative considered: require inactive users to be reactivated. That changes account lifecycle merely to close historical data and can be impossible after departure.

### Define the required set from membership timing and monthly evidence

A member is required when active and created by the target month end, or when any target-month capacity, monthly plan, daily plan, work log, allocation, or submission references that member. This excludes members created after a historical month while retaining inactive members who have evidence in that month.

Use one shared query/service for dashboard counts, close blockers, review start, and approval to prevent scope drift.

Alternative considered: all currently active members for every month. That makes newly created members block historical closes for periods before they existed.

### Submit based on allocation completeness, not planning or cost completeness

Submission validates that every active work log for the member/month is balanced. A month with no work logs is valid as an explicit zero-hour declaration. Planning mismatches and missing cost metadata remain workspace close concerns and do not prevent a member from declaring their actual effort complete.

Alternative considered: reuse all close blockers for member submission. Members cannot see or correct administrator-only cost and financial fields, so this would create an unresolvable workflow.

### Block review start and recheck at approval

`startMonthlyCostReview` will compute required submissions inside its transaction and refuse to enter `in_review` while any are draft. Monthly completeness will expose the same blockers while open. Approval keeps a fresh transactional submission check for defense in depth and compatibility with direct state changes.

Alternative considered: allow review with missing submissions. Review protection would prevent members from submitting and require an immediate reopen, creating a predictable deadlock.

### Invalidate on successful actual-effort write requests

Every service or route that mutates actual work logs or allocations receives the acting member id and calls a shared invalidation helper inside the same transaction. Daily-plan and monthly-plan edits do not invalidate; daily-plan-to-actual copy does. A rejected request does not invalidate. A successful save request against a submitted month conservatively returns it to draft even when values happen to be unchanged, avoiding fragile deep change detection.

Alternative considered: compare every persisted field and invalidate only on semantic differences. That adds complexity across multiple bulk paths without improving the safety of the completion declaration.

### Grandfather existing protected months

The migration will create system-marked submitted rows for required members of existing in-review and approved months, using the close transition timestamp where available. Existing open months receive no backfill and remain draft. This preserves approved meaning and avoids trapping an existing in-review month behind a new write requirement.

## Risks / Trade-offs

- [A member can edit immediately after submission] -> Make the automatic return to draft visible and require resubmission; workspace review remains the actual write lock.
- [Zero-hour submission can conceal forgotten entries] -> Present it explicitly as zero-hour completion and show actor/time; future working-calendar work may add expected-day warnings without changing this state model.
- [Required-member rules are limited by missing deactivation-effective dates] -> Include every member with month evidence and document that account lifecycle dates are not reconstructed.
- [Proxy submission concentrates authority] -> Restrict it to administrators and display the acting administrator in status details.
- [Legacy backfill is an inferred declaration] -> Mark it as system/legacy migration rather than attributing it to a member or administrator.

## Migration Plan

1. Add the submission table, unique key, foreign keys, and indexes.
2. Backfill system-marked submissions for required members in existing in-review and approved months; leave open months absent/draft.
3. Add repository and service APIs for required-member queries, balance validation, submit, status, and invalidation.
4. Integrate invalidation into every actual-effort transaction and add submission controls/status to monthly review and dashboard surfaces.
5. Add submission blockers to open completeness, review-start transaction, and approval recheck.
6. Verify fresh and upgraded databases, including legacy in-review/approved months, inactive members with activity, zero-hour submissions, proxy submissions, and multi-month weekly writes.

Rollback must preserve the SQLite volume. Older versions ignore the added table; if rolling forward again, migration/backfill must remain idempotent and must not overwrite user-created submission metadata.
