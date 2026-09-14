# monthly-effort-closing Specification

## Purpose

Define workspace monthly effort confirmation independently of financial approval so teams can finalize complete time records without configuring rates or monetary baselines.

## Requirements

### Requirement: Independent effort close lifecycle
The system SHALL maintain open, in-review, and confirmed effort states for each workspace month, separately from cost approval. Only active administrators SHALL start review, confirm, or reopen a month.

#### Scenario: Time-only month is confirmed
- **WHEN** all required members have submitted, saved daily working hours match allocations, and an administrator reviews then confirms a month
- **THEN** effort becomes confirmed even when all rates, contract amounts, and cost budgets are unset
- **AND** cost remains unapproved and no financial snapshots are created

#### Scenario: Zero activity month
- **WHEN** required members have explicitly submitted zero-hour months
- **THEN** administrators can review and confirm without creating artificial work logs or plans

#### Scenario: Authorization and invalid transitions
- **WHEN** a non-administrator, invalid month, or a confirmation outside in-review is submitted
- **THEN** the system rejects the transition without changing either state or history

### Requirement: Effort completeness and atomic transitions
The system SHALL validate required monthly submissions and saved daily working-hours/allocation equality inside the same transaction as review and confirmation. Plans, capacity, planning confirmation, cost data, and daily-plan differences SHALL NOT be effort blockers.

#### Scenario: Missing submission or unbalanced hours
- **WHEN** a required submission is missing or a saved day is unbalanced
- **THEN** review and confirmation are rejected with links to the affected member and date

#### Scenario: Data changes after the page was loaded
- **WHEN** a new blocker exists at transition time
- **THEN** no state or event is persisted and current issues are reported

#### Scenario: Event persistence fails
- **WHEN** storing the transition event fails
- **THEN** the state transition also rolls back

### Requirement: Effort close history and compatibility
The system SHALL record effort review, confirmation, reopening, and migration with available actors, times, and prior states while preserving existing cost events and financial snapshots.

#### Scenario: Legacy approved month
- **WHEN** an existing cost-approved month is migrated
- **THEN** its effort state becomes confirmed using the existing approval metadata and a system migration record, and its original cost status and snapshot values remain unchanged

#### Scenario: Legacy review month
- **WHEN** an existing cost-in-review month is migrated
- **THEN** its effort state becomes in-review without claiming effort confirmation or cost approval
- **AND** the administrator can confirm effort before continuing the existing cost review

#### Scenario: Legacy open month
- **WHEN** an open or absent close record is migrated
- **THEN** effort remains open without fabricated confirmations

### Requirement: Time-first monthly closing surface
The system SHALL present effort closing as the primary workflow and cost review as optional on the monthly closing screen, without requiring a global financial mode setting.

#### Scenario: Effort is confirmed and cost is not approved
- **WHEN** a user views the month
- **THEN** effort surfaces identify confirmed effort and financial surfaces identify unapproved cost
- **AND** financial missing-data messages do not imply that time confirmation failed

#### Scenario: User only manages time
- **WHEN** an administrator completes effort closing without opening the optional cost section
- **THEN** the workflow is complete for time management and no further financial action is required
