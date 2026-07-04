## ADDED Requirements

### Requirement: Effort summary report
The system SHALL provide an effort summary report filtered by date range or month, member, department, assignment role, project, project type, and task.

#### Scenario: Administrator views team report
- **WHEN** an administrator opens the report with a date range
- **THEN** the system displays matching effort totals grouped by department, member, assignment role, project, task, and day

#### Scenario: Member views own report
- **WHEN** a non-administrator opens the report with a date range
- **THEN** the system displays only that member's own effort totals

### Requirement: Report totals
The system SHALL calculate actual report totals from active effort allocations, planned totals from monthly planned effort, and capacity totals from monthly member capacity.

#### Scenario: Report totals reflect filters
- **WHEN** a report is filtered by date range, member, project, or task
- **THEN** the system includes only entries matching those filters in totals

#### Scenario: Deleted entries are excluded
- **WHEN** a time entry has been deleted
- **THEN** the system excludes it from report totals

### Requirement: Planned versus actual report
The system SHALL compare monthly capacity, planned effort, and actual allocated effort by member, assignment role, and project.

#### Scenario: Administrator views planned versus actual
- **WHEN** an administrator opens a monthly planned-versus-actual report
- **THEN** the system displays capacity hours, planned hours, actual allocated hours, unallocated or overplanned hours, and actual variance by member, role, and project

#### Scenario: Member views own planned versus actual
- **WHEN** a non-administrator opens their own monthly planned-versus-actual view
- **THEN** the system displays only that member's capacity hours, planned hours, actual allocated hours, unallocated or overplanned hours, and variance without financial values

### Requirement: Resource planning report
The system SHALL provide a month-level resource planning report for administrators.

#### Scenario: Administrator views resource planning
- **WHEN** an administrator opens the resource planning report for a month
- **THEN** the system displays each member's capacity, planned hours by project and role, total planned hours, unallocated capacity, and overplanned hours

#### Scenario: Administrator filters resource planning
- **WHEN** an administrator filters the resource planning report by department, member, role, or project
- **THEN** the system displays only matching capacity and planned effort rows

### Requirement: Administrator financial report
The system SHALL provide administrator-only project financial reporting using JPY project revenue or budget amount and JPY member cost rate snapshots.

#### Scenario: Administrator views project economics
- **WHEN** an administrator opens a project financial report
- **THEN** the system displays project revenue or budget amount, planned cost, actual cost, and gross profit values in JPY

#### Scenario: Member cannot view project economics
- **WHEN** a non-administrator requests a report or export that includes cost, revenue, or gross profit values
- **THEN** the system denies the request or omits those financial values

### Requirement: Allocation completeness report
The system SHALL show unallocated or overallocated daily work logs to administrators.

#### Scenario: Administrator reviews incomplete allocation
- **WHEN** an administrator opens allocation completeness reporting for a period
- **THEN** the system lists daily work logs whose allocation total does not match total working hours

### Requirement: CSV export
The system SHALL allow authorized users to export report results as CSV.

#### Scenario: Administrator exports team CSV
- **WHEN** an administrator exports a filtered report
- **THEN** the system downloads a CSV containing the matching team entries, totals, and financial columns appropriate to the selected report

#### Scenario: Member exports own CSV
- **WHEN** a non-administrator exports a filtered report
- **THEN** the system downloads a CSV containing only that member's own matching entries without cost, revenue, or gross profit columns

### Requirement: Empty report state
The system SHALL show a clear empty state when no entries match the selected report filters.

#### Scenario: No report data
- **WHEN** a report query matches no time entries
- **THEN** the system displays an empty state instead of an error
