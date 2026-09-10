## Purpose

Define a lightweight member/month completion declaration so zero-hour, incomplete, and submitted effort months are distinguishable before workspace cost closing.

## Requirements

### Requirement: Monthly effort submission lifecycle
The system SHALL maintain one draft or submitted effort state for each member and calendar month, treating a missing state record as draft.

#### Scenario: Month has no submission record
- **WHEN** a member or administrator views a member/month without a submission record
- **THEN** the system displays that month as draft and not submitted

#### Scenario: Member submits own month
- **WHEN** an authenticated member submits their own open month and submission validation succeeds
- **THEN** the system records submitted state with the target member, acting member, and submission timestamp

#### Scenario: Administrator submits for a member
- **WHEN** an administrator submits an eligible open month for another member and validation succeeds
- **THEN** the system records submitted state with the target member and distinct administrator actor, including when the target member is inactive

#### Scenario: Member attempts another member submission
- **WHEN** a non-administrator attempts to submit another member's month
- **THEN** the system denies the request without changing either member's submission state

#### Scenario: Zero-hour month is submitted
- **WHEN** an eligible member/month has no saved work logs or allocations and the authorized actor submits it
- **THEN** the system records submitted state as an explicit zero-hour completion declaration

### Requirement: Monthly submission validation
The system SHALL submit a member/month only while the workspace month is open and every active daily work log for that member/month has balanced total and allocated hours.

#### Scenario: Balanced month is submitted
- **WHEN** all saved work logs in the open target month have allocation totals equal to total working hours
- **THEN** the system accepts submission whether the month has many work logs or no work logs

#### Scenario: Unbalanced day blocks submission
- **WHEN** at least one saved work log in the target month has underallocated or overallocated hours
- **THEN** the system rejects submission and identifies the affected date or dates for correction

#### Scenario: Protected month rejects submission change
- **WHEN** an actor attempts to submit or otherwise change submission state for an in-review or approved month
- **THEN** the system rejects the mutation according to monthly-close protection

### Requirement: Required monthly submitters
The system SHALL determine the members whose submissions are required for a month consistently across submission summaries and monthly-close checks.

#### Scenario: Active member existed by month end
- **WHEN** a member is active and was created no later than the end of the target month
- **THEN** that member requires a submission for the month

#### Scenario: Inactive member has monthly activity
- **WHEN** an inactive member has a work log, allocation, daily plan, monthly plan, capacity, or existing submission for the target month
- **THEN** that member remains in the required-submitter set and an administrator can resolve the submission

#### Scenario: Member did not yet exist
- **WHEN** an active member was created after the end of a historical target month and has no target-month activity or submission
- **THEN** that member is not required to submit that historical month

### Requirement: Submission invalidation metadata
The system SHALL return a submitted member/month to draft after a successful actual-effort write and record the actor and invalidation timestamp.

#### Scenario: Submitted effort is changed
- **WHEN** an authorized actual-effort write succeeds for a submitted member/month
- **THEN** the system atomically returns that submission to draft and records who invalidated it and when

#### Scenario: Failed write does not invalidate submission
- **WHEN** an actual-effort write fails validation or is rejected before changing data
- **THEN** the existing submission state remains unchanged

### Requirement: Legacy protected-month compatibility
The system SHALL preserve the operability and approved meaning of protected months that predate monthly effort submissions.

#### Scenario: Existing protected month is upgraded
- **WHEN** migration finds an in-review or approved month without submission records
- **THEN** the system creates legacy/system-marked submitted states for that month's required members so the month is not deadlocked or retroactively invalidated

#### Scenario: Existing open month is upgraded
- **WHEN** migration finds an open month without submission records
- **THEN** the system leaves member/month submission state as draft and requires normal submission before a new review can begin

### Requirement: Persisted monthly submission domain integrity
The system SHALL persist monthly effort submissions only for a real `YYYY-MM` calendar month and with a supported draft or submitted status, rejecting malformed values at the persistence boundary.

#### Scenario: Unsupported submission status is persisted
- **WHEN** a write attempts to persist a monthly effort submission status other than draft or submitted
- **THEN** the system rejects the write without creating or changing the submission row

#### Scenario: Invalid submission month is persisted
- **WHEN** a write attempts to persist a monthly effort submission with a malformed month or a month number outside 01 through 12
- **THEN** the system rejects the write without creating or changing the submission row

#### Scenario: Existing valid submissions are upgraded
- **WHEN** the integrity constraints are introduced on a database containing valid draft, submitted, and legacy submission rows
- **THEN** the system preserves those rows and their actor, timestamp, invalidation, and migration metadata
