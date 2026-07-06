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

## Future Scope (v0.2+)

The following reporting capabilities are intentionally outside the v0.1 public scope:

- Date-range reporting beyond the v0.1 month-focused report.
- Task-level filter UI beyond displaying task names in report rows.
- Assignment-role-based reporting and filtering.
- Full planned-versus-actual reporting that combines capacity, monthly plans, actual allocations, unallocated capacity, overplanned hours, and variance.
- Full resource planning reports with department, member, role, and project filters.
- Financial reporting, including planned cost, actual cost, project revenue or budget amount, gross profit, and related CSV columns.
- Allocation completeness reports as a dedicated report surface.
