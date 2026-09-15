## Purpose

Define monthly project planning, optional capacity context, and planned-effort visibility.

## Requirements

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

### Requirement: Monthly capacity editing
The system SHALL allow administrators to update and delete monthly member capacity.

#### Scenario: Administrator updates monthly capacity
- **WHEN** an administrator changes capacity hours for an existing member and month
- **THEN** the system persists the updated capacity

#### Scenario: Non-administrator attempts capacity update
- **WHEN** a non-administrator attempts to create, update, or delete monthly capacity
- **THEN** the system denies the request

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

### Requirement: Monthly plan cost snapshot
The system SHALL store the member hourly cost rate snapshot on monthly planned effort.

#### Scenario: Monthly plan captures cost rate snapshot
- **WHEN** an administrator creates or updates monthly planned effort
- **THEN** the system stores the member's current hourly cost rate snapshot for administrator-only planned-cost reporting

### Requirement: Member monthly plan visibility
The system SHALL allow members to view their own project-level monthly planned hours without financial values, whether or not capacity has been recorded.

#### Scenario: Member views own monthly plan
- **WHEN** a member opens their monthly plan view
- **THEN** the system displays that member's planned hours by assigned project and assignment roles without cost, revenue, or profit values

#### Scenario: Member views plan without capacity
- **WHEN** a member opens their monthly plan view and no capacity exists for that month
- **THEN** the system displays planned project hours and shows capacity context as not set instead of treating it as an error

### Requirement: Monthly plan uniqueness
The system SHALL keep at most one monthly planned effort value for each member, project, month, and assignment role combination.

#### Scenario: Duplicate monthly plan is submitted
- **WHEN** an administrator submits a monthly plan for a member, project, month, and assignment role combination that already exists
- **THEN** the system updates the existing planned effort instead of creating a duplicate row

### Requirement: Capacity balance
The system SHALL calculate planned allocation against monthly capacity only when capacity has been recorded for a member and month, and SHALL distinguish arithmetic unallocated hours from confirmed planned availability. Capacity balance SHALL use monthly plans including internal and non-billable work, not actual effort or daily plans.

#### Scenario: Member has unallocated capacity
- **WHEN** a confirmed active member's monthly planned hours are less than recorded monthly capacity
- **THEN** the system reports the remaining capacity as planned availability, explicitly limited to the selected month

#### Scenario: Planning has not been confirmed
- **WHEN** a member has recorded capacity but unconfirmed monthly planning
- **THEN** the system labels the planning unconfirmed and does not present a positive arithmetic balance as confirmed availability
- **AND** any displayed arithmetic balance is clearly labeled provisional

#### Scenario: Member is overplanned
- **WHEN** a member's monthly planned hours exceed recorded monthly capacity
- **THEN** the system reports the excess as overplanned hours regardless of confirmation and allows otherwise valid plans to be saved

#### Scenario: Capacity is missing
- **WHEN** no monthly capacity exists for a member and month
- **THEN** the system omits capacity-balance warnings and still shows total planned hours without inventing available hours

#### Scenario: Capacity is zero
- **WHEN** recorded monthly capacity is zero
- **THEN** the system treats it as a known zero, reports any positive plans as overplanned, and does not divide by zero

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

### Requirement: Monthly and daily plan aggregation relationship
The system SHALL compare monthly planned effort and daily allocation plans by aggregation without directly linking their rows.

#### Scenario: Daily plans are compared with monthly plans
- **WHEN** a user opens daily allocation planning for a member and month
- **THEN** the system shows the member's monthly planned total, daily planned total, and the difference between them

#### Scenario: Monthly plan projects seed daily plan columns
- **WHEN** a member has monthly plans for the selected month
- **THEN** the system can include those projects as default daily plan columns without storing a link to monthly plan rows

#### Scenario: Monthly plan change does not rewrite daily plans
- **WHEN** monthly planned effort is created, updated, or deleted
- **THEN** the system does not automatically create, update, or delete daily allocation plans

#### Scenario: Daily plan change does not rewrite monthly plans
- **WHEN** daily allocation plans are created, updated, or deleted
- **THEN** the system does not automatically create, update, or delete monthly planned effort

### Requirement: Monthly plan response field masking
The system SHALL not include member credential or financial fields in monthly plan and capacity screen responses.

#### Scenario: Member monthly plan view excludes credential and cost fields
- **WHEN** a member loads their monthly plan view
- **THEN** the response contains no member password hash or hourly cost rate values

#### Scenario: Administrator capacity view excludes credential fields
- **WHEN** an administrator loads the monthly capacity management screen
- **THEN** the response contains member identifiers and display names but no member password hash values

### Requirement: Monthly plan and capacity value validation
The system SHALL accept monthly planned hours and capacity hours only as non-negative values in 0.25 hour increments, and target months only as real calendar months.

#### Scenario: Non-quarter-hour monthly hours are rejected
- **WHEN** an administrator submits monthly planned hours or capacity hours that are not divisible by 0.25 hours
- **THEN** the system rejects the submission and shows a validation error

#### Scenario: Invalid calendar month is rejected at entry
- **WHEN** a submission targets a month string such as 2026-13 that is not a real calendar month
- **THEN** the system rejects the submission with a validation error at entry time instead of failing during a later processing step

### Requirement: Project effort budget allocation context
The system SHALL compare the sum of all member monthly plans for a project with that project's optional effort budget.

#### Scenario: Administrator reviews project allocation
- **WHEN** an administrator views or edits monthly plans for a project with an effort budget
- **THEN** the system displays the project effort budget, planned hours across all months, and unallocated or overallocated hours

#### Scenario: New plan exceeds project effort budget
- **WHEN** an administrator saves a valid member monthly plan that causes total project planned hours to exceed the effort budget
- **THEN** the system saves the plan and displays an over-budget warning

#### Scenario: Project has no effort budget
- **WHEN** monthly plans are managed for a project without an effort budget
- **THEN** the system continues to accept valid plans and omits project-budget balance calculations

### Requirement: Member monthly plan balance
The system SHALL show members their planned and actual hours by assigned project for the selected month without exposing administrator-only financial values.

#### Scenario: Member reviews selected month
- **WHEN** a member opens monthly planning for a selected month
- **THEN** the system displays that member's project planned hours, actual hours, and plan balance for the month

### Requirement: Monthly allocation matrix
The system SHALL provide administrators with a monthly member-by-project overview of planned hours, member totals, optional capacity, confirmation state, and capacity balance without requiring financial baselines or daily plans.

#### Scenario: Internal work and multiple roles are included
- **WHEN** a member has 60 and 20 planned hours under different roles for project A, 40 hours for project B, and 20 hours for internal work
- **THEN** the overview shows 80 hours for A, 40 for B, 20 for internal work, and a member total of 140 hours

#### Scenario: Members and historical projects remain visible
- **WHEN** an administrator opens a month
- **THEN** the overview includes all active members and inactive members with plans or capacity in that month, and preserves planned hours for archived projects and removed assignments with their inactive status identified
- **AND** inactive members are not presented as candidates for additional allocation

#### Scenario: Missing data is not hidden
- **WHEN** an active member has neither plans nor capacity
- **THEN** the overview shows that member as unconfirmed with capacity unset and no claim of available hours

#### Scenario: Non-administrator requests the team matrix
- **WHEN** a non-administrator requests the team overview
- **THEN** the system denies access without returning other members' planning data

### Requirement: Monthly planning confirmation
The system SHALL allow only administrators to confirm an active member's monthly planning as reviewed, recording the actor and time independently of actual-effort submission and cost closing. Confirmation SHALL be optional for saving plans and require an open month and a current view of the member's plans and capacity.

#### Scenario: Zero planned work is explicitly confirmed
- **WHEN** an administrator confirms an active member with no planned hours and 160 hours of capacity in an open month
- **THEN** the system records confirmation and displays 160 hours of planned availability

#### Scenario: Confirmation without capacity
- **WHEN** an administrator confirms plans for a member without capacity
- **THEN** the system records confirmation while keeping available hours unknown

#### Scenario: Planning writes invalidate confirmation
- **WHEN** a monthly plan or capacity record is successfully created, updated, or deleted through an application or CSV write
- **THEN** the affected member and month return to unconfirmed atomically with the write, including both old and new member-month targets if they differ
- **AND** confirmations for other member-months remain unchanged

#### Scenario: Unrelated work does not invalidate confirmation
- **WHEN** actual effort, daily plans, or only an hourly-cost snapshot changes
- **THEN** the monthly planning confirmation remains unchanged

#### Scenario: Concurrent edit makes confirmation stale
- **WHEN** monthly plans or capacity change after the administrator loaded the confirmation form
- **THEN** confirmation is rejected and the administrator is asked to review the current values

#### Scenario: Protected month or unauthorized confirmation
- **WHEN** a confirmation is requested for a review or approved month, an invalid month, an inactive or unknown member, or by a non-administrator
- **THEN** the system rejects it without changing planning confirmation or existing close state

#### Scenario: Existing data is upgraded
- **WHEN** existing plans and capacities are migrated to support confirmation
- **THEN** their values remain unchanged and their confirmation state starts as unconfirmed, including protected historical months
- **AND** this state does not block existing effort submission or cost closing
