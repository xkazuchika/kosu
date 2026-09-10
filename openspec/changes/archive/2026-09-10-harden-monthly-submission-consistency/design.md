## Context

See proposal.md for motivation. Monthly submission writes and review/approval transitions already use transactions, and submission invalidation is already atomic with the corresponding effort mutation. Three effort paths perform the protected-month check immediately before, but outside, their mutation transaction. The submission table has uniqueness and foreign keys but relies on TypeScript validation for month and status domains. The dashboard main spec also has two existing scenarios attached to the wrong requirement after the prior sync.

## Goals / Non-Goals

**Goals:**

- Make the effective monthly close state part of each affected actual-effort transaction.
- Enforce supported submission month and status values in SQLite without losing valid existing records.
- Restore unambiguous ownership of dashboard scenarios and verify it mechanically.

**Non-Goals:**

- Change who must submit, submission authorization, balance validation, or close-state transitions.
- Add a new submission status or retain a full event history beyond the existing latest metadata.
- Redesign unrelated planning transactions or add a new concurrency framework.

## Decisions

### Recheck close state inside each mutation transaction

Monthly bulk entry, previous-day copy, and daily-plan-to-actual copy will call the existing open-month guard through the transaction handle before their first write. Existing outer checks may remain as fail-fast validation, but only the in-transaction check establishes the integrity guarantee. This reuses the current close-state service and keeps effort changes, submission invalidation, and lock validation within one rollback boundary.

Alternatives considered:

- Rely on synchronous single-process execution. This is currently low risk but does not protect multi-process deployments or direct concurrent writers.
- Move locking into repository functions. That would spread month and actor context through low-level APIs and make legitimate financial-only repository updates harder to distinguish.

### Add SQLite checks through a table rebuild migration

The Drizzle schema will declare checks for status membership and a seven-character numeric `YYYY-MM` value whose month component is `01` through `12`. A forward migration will rebuild `monthly_effort_submissions`, copy existing rows, recreate foreign keys and indexes, and fail atomically if pre-existing malformed data cannot satisfy the new contract. Valid draft, submitted, invalidated, and legacy rows remain byte-for-byte equivalent in their stored fields.

Alternatives considered:

- Application-only validation leaves scripts and direct database writers able to violate the persisted state domain.
- Triggers duplicate simple declarative constraints and are less discoverable in schema metadata.
- Silently normalizing malformed historical rows would hide corruption and invent business meaning.

### Correct the dashboard main-spec structure directly

The dashboard issue changes no observable behavior: the two scenarios already exist but are attached to the wrong requirement because of heading placement. It will therefore be corrected directly in the main spec rather than represented as a behavioral delta. A structural assertion will verify each scenario belongs to its intended requirement and prevent a later sync from recreating the mistake.

## Risks / Trade-offs

- [SQLite table rebuild can fail on malformed existing rows] → Keep the migration transactional and fail visibly instead of partially migrating or silently rewriting data.
- [A second lock lookup adds a small amount of work] → Reuse the indexed monthly close lookup; correctness outweighs the negligible read cost.
- [Generated Drizzle migration may not preserve the desired copy order or metadata] → Inspect the SQL and cover fresh and upgraded databases with migration tests.

## Migration Plan

1. Add schema-level check declarations and generate the next Drizzle migration.
2. Verify the migration rebuilds only the monthly submission table and recreates its unique and supporting indexes plus actor foreign keys.
3. Test fresh migration, upgrade from migration 0006 with representative valid states, rejection of malformed status/month writes, and foreign-key integrity.
4. Rollback compatibility: older application code continues to read and write valid rows because the table and column contract is unchanged; rolling the database itself back requires restoring the pre-migration database backup as documented for forward-only migrations.
