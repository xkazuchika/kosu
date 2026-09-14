## MODIFIED Requirements

### Requirement: Workspace monthly cost close
The system SHALL manage one cost-close state per workspace month using open, in-review, and approved states. Cost review SHALL be optional and starting a new cost review SHALL require confirmed effort and a fresh full cost-completeness check; existing migrated cost reviews can remain in-review while effort is reviewed.

#### Scenario: Month has no close record
- **WHEN** a user opens a month without a monthly cost-close row
- **THEN** the system treats the month as open

#### Scenario: Administrator starts monthly review
- **WHEN** an administrator moves an open cost month with confirmed effort and complete cost data to in-review
- **THEN** the system persists in-review state and appends an entered-review event with actor and timestamp

### Requirement: Transactional monthly approval
The system SHALL approve an in-review month only when a fresh completeness check has no blocking issues. Confirmed effort SHALL also be required, including when continuing a migrated cost review.

#### Scenario: Administrator approves a complete month
- **WHEN** an administrator approves an in-review month and the transactional recheck finds no blockers
- **THEN** the system saves project snapshots, appends an approval event, and marks the month approved atomically

#### Scenario: Data changes before approval
- **WHEN** the transactional approval recheck finds a blocking issue that was not shown in the prior page view
- **THEN** the system rolls back the approval and displays the current blocking issues

### Requirement: Protected month mutation policy
The system SHALL reject both member and administrator mutations for in-review and approved months. Protection SHALL also apply while effort is in-review or confirmed. The sole exception is audited missing-cost correction while both the selected and source months have open cost states; that exception SHALL NOT allow changes to hours, assignments, dates, or other work fields.

#### Scenario: Member edits protected month
- **WHEN** a member attempts an ordinary month-scoped mutation in an in-review or approved month
- **THEN** the system rejects the mutation and identifies the monthly close state

#### Scenario: Administrator edits protected month
- **WHEN** an administrator attempts an ordinary month-scoped mutation in an in-review or approved month
- **THEN** the system rejects the mutation and directs the administrator to reopen the month

### Requirement: Audited reopening
The system SHALL return an in-review or approved month to open only through an administrator action with a non-empty reason. Reopening SHALL atomically reopen both effort and cost states with their prior states recorded, including a month protected only by effort. Existing member submissions SHALL be retained until actual effort changes.

#### Scenario: Administrator reopens protected month
- **WHEN** an administrator supplies a reason to reopen an in-review or approved month
- **THEN** the system changes the state to open and appends an event containing actor, timestamp, prior state, and reason

#### Scenario: Reopen reason is missing
- **WHEN** an administrator attempts to reopen a protected month without a reason
- **THEN** the system rejects the request and leaves the state unchanged

### Requirement: Audited missing-cost correction
The system SHALL allow administrators to correct a missing saved cost snapshot only with an explicit non-negative hourly rate and reason. Correction SHALL be allowed while effort is protected if the selected month's and the target record's source month's cost states are both open. Cost-in-review and approved source months SHALL require reopening. The correction SHALL NOT alter effort confirmation, planning confirmation, or approved financial snapshots.

#### Scenario: Administrator corrects missing snapshot
- **WHEN** an administrator supplies an explicit hourly rate and reason for an identified plan or allocation with a missing snapshot
- **THEN** the system updates that snapshot and appends a correction event with actor, timestamp, target, prior value, new value, and reason

#### Scenario: Correction relies on current member rate implicitly
- **WHEN** an administrator requests correction without an explicit rate or reason
- **THEN** the system rejects the correction and does not infer a value from the member's current rate

### Requirement: Monthly close visibility
The system SHALL show monthly close state, completeness summary, warnings, and event history on administrator review surfaces. Effort and cost states SHALL be separately identified; cost-open SHALL be labeled unconfirmed, and effort confirmation alone SHALL NOT select financial snapshots or claim financial approval.

#### Scenario: Administrator views approved month
- **WHEN** an administrator opens an approved month
- **THEN** the system displays approved snapshots, approver metadata, completeness-at-approval, and lifecycle history

### Requirement: Monthly submissions gate cost review and approval
The system SHALL treat every required member/month submission that remains draft as a blocking completeness issue and SHALL not start review or approve until a fresh transactional check finds all required submissions complete. New cost reviews and approvals SHALL additionally require confirmed effort. Migrated in-review cost months SHALL remain protected and allow explicit effort confirmation before cost approval.

#### Scenario: Draft member blocks review start
- **WHEN** an administrator attempts to move an open month to in-review while one or more required member submissions remain draft
- **THEN** the system leaves the month open and displays blocking issues with links to the affected member/month reviews

#### Scenario: All required members submitted
- **WHEN** every required member has submitted, effort is confirmed, financial completeness passes, and the administrator starts cost review
- **THEN** the system transitions the month to in-review atomically with a fresh submission check

#### Scenario: Approval rechecks submissions
- **WHEN** an administrator approves an in-review month
- **THEN** the transactional completeness check includes required submission state before saving snapshots and approval

#### Scenario: Reopened month retains submission state until effort changes
- **WHEN** an administrator reopens a protected month without changing actual effort
- **THEN** existing member submissions remain submitted, and a later actual-effort write invalidates only the affected member/month
