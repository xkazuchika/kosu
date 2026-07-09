## ADDED Requirements

### Requirement: Daily allocation plans
The system SHALL allow authenticated users to manage project-level daily allocation plans by member, project, date, and planned hours.

#### Scenario: Member creates own daily allocation plan
- **WHEN** a member saves a positive planned-hours value for an active assigned project on an unlocked date
- **THEN** the system stores a daily allocation plan for that member, project, and date

#### Scenario: Existing daily allocation plan is updated
- **WHEN** a user saves a positive planned-hours value for a member, date, and project combination that already has a daily allocation plan
- **THEN** the system updates the existing daily allocation plan instead of creating a duplicate row

#### Scenario: Empty cell removes plan
- **WHEN** a user saves an empty or zero planned-hours value for a member, date, and project combination with an existing daily allocation plan
- **THEN** the system deletes the daily allocation plan row

#### Scenario: Zero-hour plan is not stored
- **WHEN** a user saves an empty or zero planned-hours value for a member, date, and project combination without an existing daily allocation plan
- **THEN** the system stores no daily allocation plan row

### Requirement: Daily allocation plan uniqueness
The system SHALL keep at most one daily allocation plan for each member, plan date, and project combination.

#### Scenario: Duplicate daily allocation plan is submitted
- **WHEN** a user submits multiple values for the same member, plan date, and project
- **THEN** the system resolves them to one stored daily allocation plan row or rejects ambiguous duplicate input

### Requirement: Daily allocation plan validation
The system SHALL validate daily allocation plan values before saving.

#### Scenario: Positive quarter-hour value is accepted
- **WHEN** a user submits a positive planned-hours value divisible by 0.25 for an assigned active project and valid date
- **THEN** the system accepts the value if the member's daily planned total remains at or below 24 hours

#### Scenario: Invalid planned-hours value is rejected
- **WHEN** a user submits a negative, non-numeric, or non-quarter-hour planned-hours value
- **THEN** the system rejects the daily plan save and shows a validation error

#### Scenario: Daily planned total over 24 hours is rejected
- **WHEN** a user submits daily plan values whose positive planned-hours total exceeds 24 hours for a member and date
- **THEN** the system rejects the daily plan save and shows a validation error

#### Scenario: Date outside selected month is rejected
- **WHEN** a user submits a daily plan date outside the selected month
- **THEN** the system rejects the daily plan save and shows a validation error

### Requirement: Daily allocation plan project eligibility
The system SHALL allow daily allocation plans only for active projects assigned to the target member.

#### Scenario: Assigned active project is accepted
- **WHEN** a user saves a daily allocation plan for an active project assigned to the target member
- **THEN** the system accepts the project if all other validation passes

#### Scenario: Unassigned project is rejected
- **WHEN** a user submits a daily allocation plan for a project not assigned to the target member
- **THEN** the system rejects the daily plan save

#### Scenario: Archived project is rejected for new plan input
- **WHEN** a user submits a new or updated daily allocation plan for an archived project
- **THEN** the system rejects the daily plan save

### Requirement: Daily allocation plan access control
The system SHALL restrict daily allocation plan viewing and editing by role.

#### Scenario: Member views and edits own daily plans
- **WHEN** a member opens daily allocation planning
- **THEN** the system exposes only that member's own daily allocation plans and own assigned projects for editing

#### Scenario: Member attempts another member's daily plans
- **WHEN** a non-administrator requests or submits daily allocation plans for another member
- **THEN** the system denies or ignores the selected member and only exposes the signed-in member's own data

#### Scenario: Administrator edits selected member daily plans
- **WHEN** an administrator opens daily allocation planning for a selected member
- **THEN** the system exposes that selected member's daily allocation plans and assigned projects for editing

### Requirement: Daily allocation plan lock handling
The system SHALL prevent daily allocation plan changes and planned-to-actual copy for locked months.

#### Scenario: Locked month daily plans are read-only
- **WHEN** a user opens daily allocation planning for a locked month
- **THEN** the system displays the plans as read-only and prevents saving changes

#### Scenario: Locked month save is rejected server-side
- **WHEN** a user submits daily allocation plan changes for a locked month
- **THEN** the system rejects the save

#### Scenario: Locked month copy is rejected server-side
- **WHEN** a user requests planned-to-actual copy for a locked month
- **THEN** the system rejects the copy

### Requirement: Daily allocation plans copy to actuals
The system SHALL copy daily allocation plans into actual daily work logs and effort allocations only for dates without existing actual allocations.

#### Scenario: Copy creates work log and allocations
- **WHEN** a user copies daily plans for a date with positive daily plan rows and no daily work log
- **THEN** the system creates a daily work log with total working hours equal to the date's planned total and creates one effort allocation per daily plan row

#### Scenario: Copy fills empty existing work log
- **WHEN** a user copies daily plans for a date with an existing daily work log and zero effort allocations
- **THEN** the system updates total working hours to the date's planned total and creates one effort allocation per daily plan row

#### Scenario: Copy skips date with actual allocations
- **WHEN** a user copies daily plans for a date whose daily work log already has one or more effort allocations
- **THEN** the system skips that date without changing total working hours or allocations

#### Scenario: Copy is idempotent
- **WHEN** a user runs copy after the same daily plans have already created actual allocations
- **THEN** the system skips those dates and does not duplicate allocations

#### Scenario: Copied allocations omit task
- **WHEN** the system creates effort allocations from daily allocation plans
- **THEN** each allocation references the planned project and planned hours without assigning a task

#### Scenario: Copy reports summary
- **WHEN** a planned-to-actual copy finishes
- **THEN** the system reports copied dates, created allocations, skipped dates with existing allocations, and dates without plans

## REMOVED Requirements

### Requirement: Daily allocation plan roadmap boundary
**Reason**: Daily allocation plans are no longer only future scope; this change implements them.
**Migration**: Replace the roadmap boundary with concrete daily allocation plan requirements in this change.
