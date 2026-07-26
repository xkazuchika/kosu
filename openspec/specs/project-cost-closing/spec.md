## Purpose

Define workspace monthly direct-labor cost closing, completeness checks, approval snapshots, corrections, and audit history.

## Requirements

### Requirement: Workspace monthly cost close
The system SHALL manage one cost-close state per workspace month using open, in-review, and approved states.

#### Scenario: Month has no close record
- **WHEN** a user opens a month without a monthly cost-close row
- **THEN** the system treats the month as open

#### Scenario: Administrator starts monthly review
- **WHEN** an administrator moves an open month to in-review
- **THEN** the system persists in-review state and appends an entered-review event with actor and timestamp

### Requirement: Explicit monthly completeness
The system SHALL calculate blocking issues and non-blocking warnings for the complete workspace month.

#### Scenario: Work-log allocation is unbalanced
- **WHEN** a daily work log's active allocation total differs from total working hours in the selected month
- **THEN** the system reports a blocking unbalanced-work-log issue with the affected member, date, and correction link

#### Scenario: Cost snapshot is missing
- **WHEN** a monthly plan, selected-month allocation, or historically relevant allocation lacks an hourly cost snapshot
- **THEN** the system reports a blocking missing-cost-snapshot issue without treating that work as zero cost

#### Scenario: Billable active project lacks baseline
- **WHEN** a billable project has planned or actual activity in the selected month but lacks contract revenue or labor cost budget
- **THEN** the system reports a blocking missing-financial-baseline issue

#### Scenario: Project has no monthly activity
- **WHEN** a project has no plan or actual activity in the selected month
- **THEN** the system does not treat absence of activity as a completeness issue

#### Scenario: Daily and monthly plans differ
- **WHEN** daily-plan totals differ from monthly-plan totals
- **THEN** the system displays a non-blocking warning and does not prevent approval solely for that difference

### Requirement: Transactional monthly approval
The system SHALL approve an in-review month only when a fresh completeness check has no blocking issues.

#### Scenario: Administrator approves a complete month
- **WHEN** an administrator approves an in-review month and the transactional recheck finds no blockers
- **THEN** the system saves project snapshots, appends an approval event, and marks the month approved atomically

#### Scenario: Data changes before approval
- **WHEN** the transactional approval recheck finds a blocking issue that was not shown in the prior page view
- **THEN** the system rolls back the approval and displays the current blocking issues

### Requirement: Protected month mutation policy
The system SHALL reject both member and administrator mutations for in-review and approved months.

#### Scenario: Member edits protected month
- **WHEN** a member attempts a month-scoped mutation in an in-review or approved month
- **THEN** the system rejects the mutation and identifies the monthly close state

#### Scenario: Administrator edits protected month
- **WHEN** an administrator attempts a month-scoped mutation in an in-review or approved month
- **THEN** the system rejects the mutation and directs the administrator to reopen the month

### Requirement: Audited reopening
The system SHALL return an in-review or approved month to open only through an administrator action with a non-empty reason.

#### Scenario: Administrator reopens protected month
- **WHEN** an administrator supplies a reason to reopen an in-review or approved month
- **THEN** the system changes the state to open and appends an event containing actor, timestamp, prior state, and reason

#### Scenario: Reopen reason is missing
- **WHEN** an administrator attempts to reopen a protected month without a reason
- **THEN** the system rejects the request and leaves the state unchanged

### Requirement: Immutable approved project snapshots
The system SHALL preserve the project financial figures approved for each month independently of later live-data changes.

#### Scenario: Project baseline changes after approval
- **WHEN** an administrator changes contract revenue, labor budget, project type, or archive state after a month was approved
- **THEN** the approved month continues to display the stored project snapshot while open months use current project data

#### Scenario: Future actuals change cumulative totals
- **WHEN** later-month allocations increase the project's live cumulative actual cost
- **THEN** an earlier approved month continues to display its cumulative actual cost through that approved month-end

### Requirement: Audited missing-cost correction
The system SHALL allow administrators to correct a missing saved cost snapshot only with an explicit non-negative hourly rate and reason.

#### Scenario: Administrator corrects missing snapshot
- **WHEN** an administrator supplies an explicit hourly rate and reason for an identified plan or allocation with a missing snapshot
- **THEN** the system updates that snapshot and appends a correction event with actor, timestamp, target, prior value, new value, and reason

#### Scenario: Correction relies on current member rate implicitly
- **WHEN** an administrator requests correction without an explicit rate or reason
- **THEN** the system rejects the correction and does not infer a value from the member's current rate

### Requirement: Monthly close visibility
The system SHALL show monthly close state, completeness summary, warnings, and event history on administrator review surfaces.

#### Scenario: Administrator views approved month
- **WHEN** an administrator opens an approved month
- **THEN** the system displays approved snapshots, approver metadata, completeness-at-approval, and lifecycle history
