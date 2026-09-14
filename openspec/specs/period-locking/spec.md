## Purpose

Define monthly close-state behavior for protecting finalized work-log, planning, and direct-labor cost data.

## Requirements

### Requirement: Monthly period lock
The system SHALL protect finalized work-log and planning data through separate effort and cost states; protection SHALL apply whenever effort is in-review or confirmed, or cost is in-review or approved.

#### Scenario: Administrator starts review
- **WHEN** an administrator moves an open month to in-review
- **THEN** the system protects the month from member and administrator mutations and records who started review and when

#### Scenario: Non-administrator attempts close transition
- **WHEN** a non-administrator attempts to change monthly close state
- **THEN** the system denies the request

### Requirement: Locked period edit prevention
The system SHALL prevent member and administrator changes to monthly capacities, monthly plans, daily plans, work logs, allocations, and import commits whenever effort or cost protects the month, with the effective close state checked in the same atomic operation as each protected mutation. Only the dedicated audited missing-cost correction under its explicit cost-state conditions SHALL be exempt; ordinary updates SHALL remain blocked.

#### Scenario: Member edits protected allocation
- **WHEN** a member attempts to create, update, or delete an allocation in an in-review or approved month
- **THEN** the system rejects the change and explains the monthly close state

#### Scenario: Administrator edits protected period data
- **WHEN** an administrator attempts a protected month-scoped mutation
- **THEN** the system rejects the change and requires reopening before correction

#### Scenario: Month becomes protected before an actual-effort transaction writes
- **WHEN** a month transitions from open to in-review after an earlier preliminary check but before an actual-effort mutation begins
- **THEN** the mutation transaction rechecks the effective close state and persists neither the effort change nor a submission invalidation

#### Scenario: Cost-only correction in an effort-confirmed month
- **WHEN** an administrator uses the dedicated audited missing-cost correction with explicit rate and reason and both selected and source cost states are open
- **THEN** only the missing rate is filled while effort stays confirmed and ordinary updates remain blocked

#### Scenario: Effort-only protection covers all writers
- **WHEN** effort is confirmed and cost is open
- **THEN** daily, weekly, monthly, copy-from-plan, deletion, capacity, CSV, effort submission, and planning confirmation writes are rejected atomically

### Requirement: Monthly period unlock
The system SHALL allow administrators to reopen a month protected by effort or cost with a non-empty reason, atomically resetting both states and recording both prior states.

#### Scenario: Administrator reopens month
- **WHEN** an administrator supplies a reason and reopens an in-review or approved month
- **THEN** the system marks the month open and appends actor, timestamp, prior state, and reason to close history

#### Scenario: Non-administrator attempts to reopen month
- **WHEN** a non-administrator attempts to reopen a protected month
- **THEN** the system denies the request

### Requirement: Locked status visibility
The system SHALL show effort status on time and planning screens and cost status on financial reports, with both states and applicable metadata on monthly closing screens.

#### Scenario: Member views protected month
- **WHEN** a member opens a daily work-log or planning view for an in-review or approved month
- **THEN** the system displays the state and disables editing controls

#### Scenario: Administrator views protected month
- **WHEN** an administrator opens reports, planning, work logs, or month management for a protected month
- **THEN** the system displays state, actor metadata, and the action required to reopen

### Requirement: Legacy monthly lock migration
The system SHALL migrate previously locked months to in-review without claiming financial approval.

#### Scenario: Existing locked month is migrated
- **WHEN** the monthly-close migration encounters an active legacy period lock
- **THEN** the system creates an in-review monthly close, preserves available actor and timestamp metadata, and keeps the month protected

#### Scenario: Existing unlocked month is migrated
- **WHEN** the migration encounters an unlocked legacy period or no period-lock row
- **THEN** the system treats that month as open
