## ADDED Requirements

### Requirement: Historical master selection and state visibility
The system SHALL include archived projects in effort-report project choices for administrators and SHALL add only archived projects referenced by the authenticated member's own non-deleted actual effort for non-administrators. Historical choices SHALL remain available across month and filter changes. Effort-report choices and rows, and planned-versus-actual rows, SHALL identify currently archived projects and inactive members without removing their historical hours.

#### Scenario: Administrator selects historical records
- **WHEN** an administrator selects an archived project and an inactive member for a month containing their effort
- **THEN** the report displays their matching non-deleted effort and totals with the current archived and inactive states
- **AND** changing other filters does not remove the selected historical master choices

#### Scenario: Member views own archived project
- **WHEN** an active non-administrator has historical actual effort on an archived project
- **THEN** the member can select that project in the effort report and export only their own matching effort
- **AND** archived projects referenced only by other members are not added to their choices and financial information is not exposed

#### Scenario: Historical visibility does not enable input
- **WHEN** a user can view an archived project in a report
- **THEN** that visibility does not permit new effort entry or assignment to the archived project

#### Scenario: Planned-versus-actual includes historical states
- **WHEN** planned-versus-actual rows reference an archived project or inactive member
- **THEN** the rows retain their planned and actual hours and identify those current states
- **AND** an inactive member is not presented as available for new work

### Requirement: Applied report context and export parity
The system SHALL display the normalized report month, applied filters, and effort-closing state, and SHALL use the same normalized conditions and authorization for the effort report and its CSV export. With unchanged underlying data, exported rows and ordering SHALL match the report, and exported hours and row count SHALL match its totals. Existing CSV column names, order, code values, and financial-data exclusion SHALL remain compatible.

#### Scenario: Export combined filters
- **WHEN** an administrator applies month, member, department, operation permission, project, and project-type filters and exports CSV without an intervening data change
- **THEN** the CSV matches the displayed rows, order, row count, and total hours
- **AND** the existing ten columns and machine-readable role and project-type values are preserved

#### Scenario: Unapplied filter edits
- **WHEN** a user edits filter fields without applying them and exports the displayed report
- **THEN** export uses the displayed report's applied conditions rather than the unapplied edits

#### Scenario: Invalid month and empty result
- **WHEN** a report is requested with an invalid month or conditions matching no rows
- **THEN** the page and export use the same workspace-current-month fallback for an invalid month
- **AND** an empty result displays zero totals and exports only the existing CSV header

#### Scenario: Member attempts another member export
- **WHEN** a non-administrator supplies another member's identifier in report or export parameters
- **THEN** the system restricts both results to the authenticated member and exposes no financial values

### Requirement: Understandable report labels and classification basis
The system SHALL display project types as 請求対象, 社内作業, and 非請求 for billable, internal, and non_billable respectively in effort-report UI. It SHALL distinguish 操作権限 from 案件内の役割 in the effort and planned-versus-actual reports, explain that effort-report master names and classifications use current master values even for confirmed months, and explain that CSV retains code representations.

#### Scenario: Master classification changes after confirmation
- **WHEN** a member department or operation permission, or project type, changes after a month's effort is confirmed
- **THEN** the effort report and CSV use the current classification and the page explains that basis
- **AND** the master change does not rewrite actual hours, effort-closing state, or saved cost snapshots

#### Scenario: User reads project type and role
- **WHEN** a user opens the effort or planned-versus-actual report
- **THEN** applicable project types are shown with the defined Japanese labels and operation permission is not described as the assignment role
- **AND** the CSV export explanation identifies its retained code representations
