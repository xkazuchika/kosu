## Purpose

Define reporting behavior for effort review, planned-versus-actual comparison, and future profitability boundaries.

## Requirements

### Requirement: v0.1 basic effort report
The system SHALL provide a basic effort report for viewing actual effort allocations by month.

#### Scenario: Administrator views monthly team effort
- **WHEN** an administrator opens the report for a month
- **THEN** the system displays matching effort allocation rows across the team with date, member, project, task, allocated hours, and note fields

#### Scenario: Member views own monthly effort
- **WHEN** a non-administrator opens the report for a month
- **THEN** the system displays only that member's own effort allocation rows

### Requirement: v0.1 report filters
The system SHALL support lightweight report filtering suitable for v0.1 effort review.

#### Scenario: User filters by month and project
- **WHEN** a user filters the effort report by month, project, or project type
- **THEN** the system includes only matching active effort allocation rows

#### Scenario: Administrator filters by member or department
- **WHEN** an administrator filters the effort report by member or department
- **THEN** the system includes only matching team effort allocation rows

### Requirement: v0.1 report totals
The system SHALL calculate report totals from active effort allocations.

#### Scenario: Report totals reflect active allocations
- **WHEN** a report is displayed
- **THEN** the system displays total allocated hours and row count for the matching allocation rows

#### Scenario: Deleted allocations are excluded
- **WHEN** an allocation has been deleted
- **THEN** the system excludes it from report rows and totals

### Requirement: v0.1 CSV export
The system SHALL allow authorized users to export basic effort report results as CSV.

#### Scenario: Administrator exports team CSV
- **WHEN** an administrator exports a filtered report
- **THEN** the system downloads a CSV containing the matching team effort rows

#### Scenario: Member exports own CSV
- **WHEN** a non-administrator exports a filtered report
- **THEN** the system downloads a CSV containing only that member's own matching effort rows

### Requirement: Empty report state
The system SHALL show a clear empty state when no entries match the selected report filters.

#### Scenario: No report data
- **WHEN** a report query matches no effort allocations
- **THEN** the system displays an empty state instead of an error

### Requirement: v0.2 planned-versus-actual report
The system SHALL provide a supported planned-versus-actual effort report by month using monthly plans and actual effort allocations.

#### Scenario: Administrator views team planned-versus-actual
- **WHEN** an administrator opens the planned-versus-actual report for a month
- **THEN** the system displays team rows comparing planned hours, actual allocated hours, and variance by member and project

#### Scenario: Member views own planned-versus-actual
- **WHEN** a non-administrator opens the planned-versus-actual report for a month
- **THEN** the system displays only that member's own planned hours, actual allocated hours, and variance

#### Scenario: Planned-versus-actual excludes financial values
- **WHEN** a user opens the planned-versus-actual report
- **THEN** the system does not display revenue, budget, gross profit, or profitability values

### Requirement: v0.2 capacity comparison report
The system SHALL show monthly capacity, total planned hours, total actual allocated hours, unallocated capacity, and overplanned hours when capacity data is available, while keeping planned-versus-actual reporting useful without capacity.

#### Scenario: Capacity comparison is shown
- **WHEN** a user opens the planned-versus-actual report for a month with capacity and plan data
- **THEN** the system displays capacity, planned total, actual total, unallocated capacity, and overplanned hours according to the user's access level

#### Scenario: Capacity comparison is omitted when capacity is missing
- **WHEN** a user opens the planned-versus-actual report for a month with plans or actuals but no capacity
- **THEN** the system displays planned and actual totals without showing capacity as required or erroneous

### Requirement: Planned-versus-actual source remains monthly plans
The system SHALL keep the existing planned-versus-actual report based on monthly planned effort while daily allocation plans are introduced.

#### Scenario: Planned-versus-actual report uses monthly plans
- **WHEN** a user opens the existing planned-versus-actual report after daily allocation plans exist
- **THEN** the system continues to use monthly planned effort as the planned side of the comparison

#### Scenario: Daily plan differences are shown outside existing report
- **WHEN** a user needs to compare daily plan totals with monthly planned totals
- **THEN** the system shows that comparison in the daily allocation planning workflow rather than changing the existing planned-versus-actual report semantics

### Requirement: Profitability reporting roadmap boundary
The system SHALL treat planned cost, actual cost, revenue or budget, gross profit, and variance reporting as future target capabilities for administrator-only project/month reporting.

#### Scenario: Profitability reporting is proposed after v0.3
- **WHEN** profitability reporting is added to a future change
- **THEN** the system specifies project/month reports that compare revenue or budget with planned and actual labor cost

#### Scenario: Profitability reporting avoids accounting scope
- **WHEN** profitability reporting is designed
- **THEN** the system keeps the scope to project tracking visibility and does not add invoicing, accounting ledger, payment collection, or tax calculation features

## Future Scope (v0.3+)

The following reporting capabilities are intentionally outside the v0.2 public scope:

- Date-range reporting beyond the v0.1 month-focused report.
- Task-level filter UI beyond displaying task names in report rows.
- Assignment-role-based reporting and filtering.
- Full resource planning reports with department, member, role, and project filters.
- Financial reporting implementation, including planned cost, actual cost, project revenue or budget amount, gross profit, and related CSV columns.
- Allocation completeness reports as a dedicated report surface.
