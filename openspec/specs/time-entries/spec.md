## Purpose

Define daily work logs, effort allocations, monthly bulk entry, and daily allocation plans.

## Requirements

### Requirement: Daily work log creation
The system SHALL allow authenticated members to record a daily work log with work date and total working hours.

#### Scenario: Member records daily working hours
- **WHEN** a member submits a daily work log with a valid work date and positive total working hours
- **THEN** the system stores the daily work log for that member

#### Scenario: Invalid working hours are rejected
- **WHEN** a member submits a daily work log with zero, negative, or otherwise invalid total working hours
- **THEN** the system rejects the daily work log and shows a validation error

### Requirement: Time increment
The system SHALL validate working hours and allocated hours using 0.25 hour increments.

#### Scenario: Valid quarter-hour increment
- **WHEN** a member submits working hours or allocated hours such as 0.25, 0.5, 1.25, or 8.0
- **THEN** the system accepts the value if all other validation passes

#### Scenario: Invalid time increment
- **WHEN** a member submits working hours or allocated hours that are not divisible by 0.25 hours
- **THEN** the system rejects the value and shows a validation error

### Requirement: Effort allocation creation
The system SHALL allow authenticated members to allocate daily working hours across assigned active projects and optional active tasks.

#### Scenario: Member allocates daily effort
- **WHEN** a member submits an allocation with an assigned active project, valid optional task, positive allocated hours, and optional note
- **THEN** the system stores the allocation under that member's daily work log

#### Scenario: Unassigned project allocation is rejected
- **WHEN** a member submits an allocation for a project assigned to another member or not assigned to the member
- **THEN** the system rejects the allocation

#### Scenario: Member self-assigns before allocation
- **WHEN** a member self-assigns an existing active project before entering an allocation
- **THEN** the system allows that member to allocate effort to the newly assigned project

#### Scenario: Allocation captures cost rate snapshot
- **WHEN** the system stores an effort allocation
- **THEN** the system stores the member's current hourly cost rate snapshot for administrator-only cost reporting

### Requirement: Allocation balance
The system SHALL show allocated total and unallocated hours for each daily work log.

#### Scenario: Allocations match working hours
- **WHEN** a daily work log has allocated hours equal to total working hours
- **THEN** the system shows zero unallocated hours

#### Scenario: Allocations do not match working hours
- **WHEN** a daily work log has allocated hours less than or greater than total working hours
- **THEN** the system saves valid allocations and displays a warning with the unallocated or overallocated difference

### Requirement: Daily entry review
The system SHALL allow members to view their own daily work logs and allocations grouped by work date.

#### Scenario: Member views daily entries
- **WHEN** a member opens their timesheet for a selected date range
- **THEN** the system displays that member's daily work logs, allocations, allocated totals, and unallocated hours grouped by date

### Requirement: Filtered daily entry review
The system SHALL allow users to select a month when reviewing daily work logs and to show only work logs whose allocation total differs from total working hours.

#### Scenario: Member selects a work-log month
- **WHEN** a member selects a valid month in the daily work-log list
- **THEN** the system displays only that member's saved work logs in the selected month

#### Scenario: Member filters unbalanced work logs
- **WHEN** a member selects the unbalanced allocation status for a selected month
- **THEN** the system displays only saved work logs whose allocation total is not equal to total working hours

#### Scenario: Administrator filters selected member work logs
- **WHEN** an administrator selects a member, a valid month, and the unbalanced allocation status
- **THEN** the system displays only the selected member's unbalanced saved work logs for that month

### Requirement: Daily work log and allocation editing
The system SHALL allow members to edit and delete their own daily work logs and allocations.

#### Scenario: Member edits own work log
- **WHEN** a member updates their own daily work log or allocation with valid values
- **THEN** the system persists the updated work log or allocation

#### Scenario: Member deletes own allocation
- **WHEN** a member deletes their own allocation
- **THEN** the system removes the allocation from active timesheet and report totals

### Requirement: Administrative entry access
The system SHALL allow administrators to view, edit, and delete any member's daily work logs and allocations.

#### Scenario: Administrator edits another member entry
- **WHEN** an administrator updates another member's daily work log or allocation with valid values
- **THEN** the system persists the updated record

#### Scenario: Member attempts to edit another member entry
- **WHEN** a non-administrator attempts to edit another member's daily work log or allocation
- **THEN** the system denies the request

### Requirement: Cost fields hidden during entry
The system SHALL not display administrator-managed cost or financial metadata on non-administrator effort-entry screens.

#### Scenario: Member opens effort entry screen
- **WHEN** a non-administrator opens the effort-entry screen
- **THEN** the system displays working hours, assigned projects, tasks, allocated hours, and notes without administrator-only financial fields

### Requirement: Entry validation against archived work items
The system SHALL prevent new or updated active allocations from referencing archived projects or archived tasks.

#### Scenario: Archived project cannot receive new entry
- **WHEN** a member submits a new allocation for an archived project
- **THEN** the system rejects the allocation

#### Scenario: Historical archived project entry remains visible
- **WHEN** a project is archived after allocations already reference it
- **THEN** the system keeps those historical allocations visible with their original project association

### Requirement: Monthly work-log bulk entry
The system SHALL allow authenticated users to review and edit daily work-log total hours for a selected month in a calendar-like monthly view.

#### Scenario: Member views monthly work-log entry
- **WHEN** a member opens the monthly work-log entry view for a month
- **THEN** the system displays one row per day with date, weekday, total working hours, allocated total, variance, status, and a link to the daily detail screen

#### Scenario: Member saves multiple daily totals
- **WHEN** a member submits valid daily total working hours for multiple days in the selected month
- **THEN** the system creates or updates those daily work logs without changing existing project or task allocations

#### Scenario: Invalid monthly bulk hours are rejected
- **WHEN** a member submits negative values or values that do not use 0.25 hour increments from the monthly work-log entry view
- **THEN** the system rejects the submission and shows a validation error

### Requirement: Monthly work-log administrative access
The system SHALL allow administrators to use monthly work-log bulk entry for any selected member.

#### Scenario: Administrator edits another member month
- **WHEN** an administrator opens monthly work-log entry with a selected member and submits valid daily total working hours
- **THEN** the system creates or updates daily work logs for the selected member

#### Scenario: Non-administrator cannot select another member
- **WHEN** a non-administrator requests monthly work-log entry for another member
- **THEN** the system ignores or denies the selected member and only exposes the signed-in member's own work logs

### Requirement: Monthly work-log lock handling
The system SHALL respect monthly close state in daily and monthly work-log mutation paths.

#### Scenario: Protected month is read-only for member
- **WHEN** a non-administrator opens monthly work-log entry for an in-review or approved month
- **THEN** the system displays the state and prevents edits to daily work logs and allocations in that month

#### Scenario: Protected month is read-only for administrator
- **WHEN** an administrator opens or submits daily or monthly work-log edits for an in-review or approved month
- **THEN** the system rejects edits and requires reopening the month before correction

### Requirement: Monthly close cannot be bypassed
The system SHALL apply the monthly close guard to every route and service that can change selected-month work-log or allocation data.

#### Scenario: Monthly bulk entry targets protected month
- **WHEN** a user submits monthly work-log totals for an in-review or approved month
- **THEN** the system rejects the entire submission without partial updates

#### Scenario: Daily-plan copy targets protected month
- **WHEN** a user copies daily plans to actuals for an in-review or approved month
- **THEN** the system rejects the copy before creating work logs or allocations

#### Scenario: Import targets protected month
- **WHEN** an administrator commits an import containing month-scoped data for an in-review or approved month
- **THEN** the system rejects affected rows or the atomic import according to the existing import transaction policy and reports the protected month

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
