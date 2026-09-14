## ADDED Requirements

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

## MODIFIED Requirements

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
