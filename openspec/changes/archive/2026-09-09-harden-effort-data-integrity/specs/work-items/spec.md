## ADDED Requirements

### Requirement: Active assignment integrity
The system SHALL keep at most one active assignment for each member and project, accept new active assignments only for active members and active projects, and preserve removed assignments as history.

#### Scenario: Duplicate active assignment is requested
- **WHEN** an interactive, concurrent, direct, or imported write attempts to create an assignment for a member/project pair that already has an active assignment
- **THEN** the system keeps exactly one active assignment and does not create a duplicate active row

#### Scenario: Assignment targets are inactive
- **WHEN** an assignment write targets an inactive member or archived project
- **THEN** the system rejects the write without creating an active assignment

#### Scenario: Removed assignment is assigned again
- **WHEN** an administrator or member creates a valid assignment for a member/project pair whose previous assignments are removed
- **THEN** the system creates or reactivates one active assignment while retaining the removed assignment history

#### Scenario: Administrator changes active assignment role
- **WHEN** an administrator changes the optional role for an existing active member/project assignment
- **THEN** the system updates that active assignment instead of creating another active assignment

#### Scenario: Existing duplicate data is upgraded
- **WHEN** an installation contains multiple active assignments for one member/project pair before the integrity migration
- **THEN** the upgrade deterministically retains one active assignment, marks the others as removed history, and completes the uniqueness enforcement without deleting assignment rows
