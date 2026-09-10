## MODIFIED Requirements

### Requirement: Locked period edit prevention
The system SHALL prevent member and administrator changes to monthly capacities, monthly plans, daily plans, work logs, allocations, and import commits in in-review and approved months, with the effective close state checked in the same atomic operation as each protected mutation.

#### Scenario: Member edits protected allocation
- **WHEN** a member attempts to create, update, or delete an allocation in an in-review or approved month
- **THEN** the system rejects the change and explains the monthly close state

#### Scenario: Administrator edits protected period data
- **WHEN** an administrator attempts a protected month-scoped mutation
- **THEN** the system rejects the change and requires reopening before correction

#### Scenario: Month becomes protected before an actual-effort transaction writes
- **WHEN** a month transitions from open to in-review after an earlier preliminary check but before an actual-effort mutation begins
- **THEN** the mutation transaction rechecks the effective close state and persists neither the effort change nor a submission invalidation
