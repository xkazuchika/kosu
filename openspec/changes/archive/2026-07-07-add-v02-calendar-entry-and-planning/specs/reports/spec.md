## ADDED Requirements

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
The system SHALL show monthly capacity, total planned hours, total actual allocated hours, unallocated capacity, and overplanned hours where the data is available.

#### Scenario: Capacity comparison is shown
- **WHEN** a user opens the planned-versus-actual report for a month with capacity and plan data
- **THEN** the system displays capacity, planned total, actual total, unallocated capacity, and overplanned hours according to the user's access level
