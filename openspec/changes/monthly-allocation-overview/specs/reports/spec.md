## MODIFIED Requirements

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
