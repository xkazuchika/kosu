## ADDED Requirements

### Requirement: CSV import business-rule parity
The system SHALL apply the same domain, lifecycle, and relationship validation to CSV preview and commit that applies to equivalent interactive writes.

#### Scenario: Member import validates cost and active flag
- **WHEN** a member CSV row contains an invalid hourly cost rate or an `isActive` value other than the supported true and false forms
- **THEN** preview reports row-level errors and commit stores none of that row

#### Scenario: Assignment import validates active targets
- **WHEN** an assignment CSV row refers to an inactive member or archived project
- **THEN** preview reports a row-level error and commit does not create an active assignment

#### Scenario: Capacity import validates active member
- **WHEN** a monthly-capacity CSV row refers to an inactive member
- **THEN** preview reports a row-level error and commit does not create or update capacity

#### Scenario: Monthly plan import validates eligibility
- **WHEN** a monthly-plan CSV row refers to an inactive member, archived project, or project not actively assigned to that member
- **THEN** preview reports a row-level error and commit does not create or update the plan

#### Scenario: Commit revalidates previewed rows
- **WHEN** referenced member, project, assignment, or monthly-close state changes after preview but before commit
- **THEN** commit revalidates the rows inside the atomic operation and stores no partial import when any row is no longer valid

### Requirement: Project effort budget CSV parity
The system SHALL include the optional project effort budget in project CSV templates, imports, and administrative exports with the same validation as project forms.

#### Scenario: Project effort budget round-trips through CSV
- **WHEN** an administrator exports projects and imports the resulting supported fields
- **THEN** each valid optional effort budget is preserved in 0.25-hour increments

#### Scenario: Invalid imported effort budget is rejected
- **WHEN** a project CSV row contains a negative, non-numeric, or non-quarter-hour effort budget
- **THEN** preview reports a row-level error and commit stores none of that row

#### Scenario: Older project CSV remains accepted
- **WHEN** a project CSV uses the previously supported headers without the optional effort-budget column
- **THEN** the system continues to validate and import the row without clearing an existing effort budget solely because that optional column is absent
