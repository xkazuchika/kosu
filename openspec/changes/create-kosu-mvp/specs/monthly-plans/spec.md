## ADDED Requirements

### Requirement: Monthly member capacity
The system SHALL allow administrators to record each member's available working capacity by month.

#### Scenario: Administrator creates monthly capacity
- **WHEN** an administrator records capacity hours for an active member and target month
- **THEN** the system stores the member's available capacity for that month

#### Scenario: Invalid monthly capacity is rejected
- **WHEN** an administrator submits monthly capacity with an inactive member, invalid month, or negative capacity hours
- **THEN** the system rejects the capacity record and shows validation errors

### Requirement: Monthly capacity editing
The system SHALL allow administrators to update and delete monthly member capacity.

#### Scenario: Administrator updates monthly capacity
- **WHEN** an administrator changes capacity hours for an existing member and month
- **THEN** the system persists the updated capacity

#### Scenario: Non-administrator attempts capacity update
- **WHEN** a non-administrator attempts to create, update, or delete monthly capacity
- **THEN** the system denies the request

### Requirement: Monthly planned effort
The system SHALL allow administrators to record planned effort hours by member, project, month, and optional assignment role.

#### Scenario: Administrator creates monthly plan
- **WHEN** an administrator creates a monthly plan for an active member assigned to an active project with a target month, planned hours, and optional assignment role
- **THEN** the system stores the planned effort for that member, project, month, and role

#### Scenario: Invalid monthly plan is rejected
- **WHEN** an administrator submits a monthly plan with an inactive member, unassigned project, invalid month, or negative planned hours
- **THEN** the system rejects the monthly plan and shows validation errors

### Requirement: Monthly plan editing
The system SHALL allow administrators to update and delete monthly planned effort.

#### Scenario: Administrator updates monthly plan
- **WHEN** an administrator changes planned hours for an existing member, project, and month
- **THEN** the system persists the updated planned effort

#### Scenario: Non-administrator attempts monthly plan update
- **WHEN** a non-administrator attempts to create, update, or delete monthly planned effort
- **THEN** the system denies the request

### Requirement: Monthly plan cost snapshot
The system SHALL store the member hourly cost rate snapshot on monthly planned effort.

#### Scenario: Monthly plan captures cost rate snapshot
- **WHEN** an administrator creates or updates monthly planned effort
- **THEN** the system stores the member's current hourly cost rate snapshot for administrator-only planned-cost reporting

### Requirement: Member monthly plan visibility
The system SHALL allow members to view their own monthly capacity and monthly planned hours without financial values.

#### Scenario: Member views own monthly plan
- **WHEN** a member opens their monthly plan view
- **THEN** the system displays that member's capacity, planned hours by assigned project, assignment roles, and unallocated or overplanned hours without cost, revenue, or profit values

### Requirement: Monthly plan uniqueness
The system SHALL keep at most one monthly planned effort value for each member, project, month, and assignment role combination.

#### Scenario: Duplicate monthly plan is submitted
- **WHEN** an administrator submits a monthly plan for a member, project, month, and assignment role combination that already exists
- **THEN** the system updates the existing planned effort instead of creating a duplicate row

### Requirement: Capacity balance
The system SHALL calculate planned allocation against monthly capacity for each member and month.

#### Scenario: Member has unallocated capacity
- **WHEN** a member's monthly planned hours are less than monthly capacity
- **THEN** the system reports the remaining capacity as unallocated hours

#### Scenario: Member is overplanned
- **WHEN** a member's monthly planned hours exceed monthly capacity
- **THEN** the system reports the excess as overplanned hours
