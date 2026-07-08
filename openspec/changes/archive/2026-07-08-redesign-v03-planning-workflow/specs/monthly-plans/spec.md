## MODIFIED Requirements

### Requirement: Monthly member capacity
The system SHALL allow administrators to optionally record each member's available working capacity by month as planning context.

#### Scenario: Administrator creates monthly capacity
- **WHEN** an administrator records capacity hours for an active member and target month
- **THEN** the system stores the member's available capacity for that month

#### Scenario: Invalid monthly capacity is rejected
- **WHEN** an administrator submits monthly capacity with an inactive member, invalid month, or negative capacity hours
- **THEN** the system rejects the capacity record and shows validation errors

#### Scenario: Monthly planning works without capacity
- **WHEN** no capacity has been recorded for a member and month
- **THEN** the system still allows monthly planned effort to be created, edited, displayed, and compared with actual effort

### Requirement: Monthly planned effort
The system SHALL allow administrators to record project-level planned effort hours by member, project, month, and optional assignment role as the primary monthly planning input.

#### Scenario: Administrator creates monthly plan
- **WHEN** an administrator creates a monthly plan for an active member assigned to an active project with a target month, planned hours, and optional assignment role
- **THEN** the system stores the planned effort for that member, project, month, and role

#### Scenario: Invalid monthly plan is rejected
- **WHEN** an administrator submits a monthly plan with an inactive member, unassigned project, invalid month, or negative planned hours
- **THEN** the system rejects the monthly plan and shows validation errors

### Requirement: Monthly plan editing
The system SHALL allow administrators to update and delete monthly planned effort from the monthly planning workflow.

#### Scenario: Administrator updates monthly plan
- **WHEN** an administrator changes planned hours or assignment role for an existing member, project, and month
- **THEN** the system persists the updated planned effort

#### Scenario: Administrator deletes monthly plan
- **WHEN** an administrator deletes an existing monthly planned effort row
- **THEN** the system removes that planned effort from planning and planned-versus-actual totals

#### Scenario: Non-administrator attempts monthly plan update
- **WHEN** a non-administrator attempts to create, update, or delete monthly planned effort
- **THEN** the system denies the request

### Requirement: Member monthly plan visibility
The system SHALL allow members to view their own project-level monthly planned hours without financial values, whether or not capacity has been recorded.

#### Scenario: Member views own monthly plan
- **WHEN** a member opens their monthly plan view
- **THEN** the system displays that member's planned hours by assigned project and assignment roles without cost, revenue, or profit values

#### Scenario: Member views plan without capacity
- **WHEN** a member opens their monthly plan view and no capacity exists for that month
- **THEN** the system displays planned project hours and shows capacity context as not set instead of treating it as an error

### Requirement: Capacity balance
The system SHALL calculate planned allocation against monthly capacity only when capacity has been recorded for a member and month.

#### Scenario: Member has unallocated capacity
- **WHEN** a member's monthly planned hours are less than recorded monthly capacity
- **THEN** the system reports the remaining capacity as unallocated hours

#### Scenario: Member is overplanned
- **WHEN** a member's monthly planned hours exceed recorded monthly capacity
- **THEN** the system reports the excess as overplanned hours

#### Scenario: Capacity is missing
- **WHEN** no monthly capacity exists for a member and month
- **THEN** the system omits capacity-balance warnings and still shows total planned hours

### Requirement: Monthly plans as planning source
The system SHALL use project-level monthly planned effort as the v0.3 planning source for planned-versus-actual views, with monthly capacity used as optional context.

#### Scenario: Plan data feeds planned-versus-actual view
- **WHEN** a user opens a planned-versus-actual view for a month
- **THEN** the system uses monthly planned effort for that month as the planned side of the comparison

#### Scenario: Capacity data enriches planned-versus-actual view
- **WHEN** capacity exists for the selected month
- **THEN** the system shows capacity comparison context alongside planned and actual effort

#### Scenario: Missing plans show guidance
- **WHEN** a planned-versus-actual view has capacity or actuals but no monthly planned effort
- **THEN** the system displays a clear empty or partial-planning state with guidance to create monthly plans
