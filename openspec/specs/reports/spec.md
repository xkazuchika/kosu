## Purpose

Define reporting behavior for effort review, planned-versus-actual comparison, and administrator-only project financial review.

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
The system SHALL show monthly capacity, total planned hours, total actual allocated hours, planning confirmation state, unallocated capacity, and overplanned hours when capacity data is available, while keeping planned-versus-actual reporting useful without capacity. Positive unallocated capacity SHALL be presented as planned availability only for confirmed active members; unconfirmed arithmetic balances SHALL be identified as provisional.

#### Scenario: Capacity comparison is shown
- **WHEN** a user opens the planned-versus-actual report for a month with capacity and plan data
- **THEN** the system displays capacity, planned total, actual total, confirmation state, unallocated capacity, and overplanned hours according to the user's access level
- **AND** availability uses capacity minus monthly planned hours and does not subtract actual hours a second time

#### Scenario: Capacity comparison is omitted when capacity is missing
- **WHEN** a user opens the planned-versus-actual report for a month with plans or actuals but no capacity
- **THEN** the system displays planned and actual totals without showing capacity as required or erroneous

#### Scenario: Unconfirmed empty plans
- **WHEN** a member has 160 hours of capacity and no confirmed plans
- **THEN** the report shows planning as unconfirmed rather than claiming that the member has 160 hours available

#### Scenario: Member sees only personal confirmation
- **WHEN** a non-administrator opens the report
- **THEN** the report includes only their own hours and planning confirmation state and no financial or other member data

#### Scenario: Inactive member has a positive balance
- **WHEN** a report includes an inactive member with a positive capacity balance
- **THEN** the member is identified as inactive and is not presented as available for new work

### Requirement: Planned-versus-actual source remains monthly plans
The system SHALL keep the existing planned-versus-actual report based on monthly planned effort while daily allocation plans are introduced.

#### Scenario: Planned-versus-actual report uses monthly plans
- **WHEN** a user opens the existing planned-versus-actual report after daily allocation plans exist
- **THEN** the system continues to use monthly planned effort as the planned side of the comparison

#### Scenario: Daily plan differences are shown outside existing report
- **WHEN** a user needs to compare daily plan totals with monthly planned totals
- **THEN** the system shows that comparison in the daily allocation planning workflow rather than changing the existing planned-versus-actual report semantics

### Requirement: Profitability reporting roadmap boundary
The system SHALL provide administrator-only project financial review that compares contract revenue and labor cost budget with planned and actual direct-labor cost, while preserving the existing planned-versus-actual effort report as a non-financial report.

#### Scenario: Administrator views project financial review
- **WHEN** an administrator opens project financial review for a selected month
- **THEN** the system displays project/month planned and actual labor cost together with project-level contract revenue, labor cost budget, cumulative actual labor cost, and applicable labor-margin metrics

#### Scenario: Existing planned-versus-actual remains non-financial
- **WHEN** a user opens the existing planned-versus-actual effort report
- **THEN** the system does not display revenue, budget, cost, gross profit, or profitability values

#### Scenario: Project financial review avoids accounting scope
- **WHEN** an administrator uses project financial review
- **THEN** the system keeps the scope to project tracking visibility and does not add invoicing, accounting ledger, payment collection, or tax calculation features

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

## Future Scope (v0.3+)

The following reporting capabilities are intentionally outside the v0.2 public scope:

- Date-range reporting beyond the v0.1 month-focused report.
- Task-level filter UI beyond displaying task names in report rows.
- Assignment-role-based reporting and filtering.
- Full resource planning reports with department, member, role, and project filters.
- Allocation completeness reports as a dedicated report surface.
