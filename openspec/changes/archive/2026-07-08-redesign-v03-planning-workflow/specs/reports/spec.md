## MODIFIED Requirements

### Requirement: v0.2 capacity comparison report
The system SHALL show monthly capacity, total planned hours, total actual allocated hours, unallocated capacity, and overplanned hours when capacity data is available, while keeping planned-versus-actual reporting useful without capacity.

#### Scenario: Capacity comparison is shown
- **WHEN** a user opens the planned-versus-actual report for a month with capacity and plan data
- **THEN** the system displays capacity, planned total, actual total, unallocated capacity, and overplanned hours according to the user's access level

#### Scenario: Capacity comparison is omitted when capacity is missing
- **WHEN** a user opens the planned-versus-actual report for a month with plans or actuals but no capacity
- **THEN** the system displays planned and actual totals without showing capacity as required or erroneous

## ADDED Requirements

### Requirement: Profitability reporting roadmap boundary
The system SHALL treat planned cost, actual cost, revenue or budget, gross profit, and variance reporting as future target capabilities for administrator-only project/month reporting.

#### Scenario: Profitability reporting is proposed after v0.3
- **WHEN** profitability reporting is added to a future change
- **THEN** the system specifies project/month reports that compare revenue or budget with planned and actual labor cost

#### Scenario: Profitability reporting avoids accounting scope
- **WHEN** profitability reporting is designed
- **THEN** the system keeps the scope to project tracking visibility and does not add invoicing, accounting ledger, payment collection, or tax calculation features
