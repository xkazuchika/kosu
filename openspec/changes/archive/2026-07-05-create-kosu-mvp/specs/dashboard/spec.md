## ADDED Requirements

### Requirement: Member dashboard
The system SHALL provide a role-appropriate dashboard after login for non-administrator members.

#### Scenario: Member opens dashboard
- **WHEN** a non-administrator signs in
- **THEN** the system displays today's input status, current-month planned hours, current-month actual hours, allocation warnings, and assigned projects without financial values

#### Scenario: Member has incomplete daily allocation
- **WHEN** a member has a daily work log whose allocations do not match total working hours
- **THEN** the dashboard displays an incomplete allocation warning for that member

### Requirement: Administrator dashboard
The system SHALL provide an administrator dashboard with operational and financial summaries.

#### Scenario: Administrator opens dashboard
- **WHEN** an administrator signs in
- **THEN** the system displays team input status, incomplete allocations, self-assigned project alerts, overplanned members, project planned-vs-actual summaries, locked-period status, and administrator-only financial summaries

#### Scenario: Administrator reviews self-assignment alert
- **WHEN** a member has self-assigned to a project
- **THEN** the administrator dashboard displays the member, project, and assignment date for review

#### Scenario: Administrator dashboard protects financial data
- **WHEN** a non-administrator requests administrator dashboard financial data
- **THEN** the system denies the request

### Requirement: Dashboard empty states
The system SHALL display useful empty states on dashboards when setup or work data is missing.

#### Scenario: No projects exist
- **WHEN** an administrator opens the dashboard before any projects exist
- **THEN** the system displays guidance to create or import projects

#### Scenario: Member has no assigned projects
- **WHEN** a member opens the dashboard without active project assignments
- **THEN** the system displays a clear no-assigned-projects state

### Requirement: Dashboard navigation
The system SHALL link dashboard summaries to the related operational pages.

#### Scenario: Administrator follows incomplete allocation summary
- **WHEN** an administrator selects the incomplete allocation summary
- **THEN** the system opens the related allocation completeness report or filtered work-log view

#### Scenario: Member follows input status
- **WHEN** a member selects today's input status
- **THEN** the system opens that member's daily work-log entry page for today
