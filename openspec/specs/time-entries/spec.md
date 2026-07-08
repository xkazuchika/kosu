## Purpose

Define daily work logs, effort allocations, monthly bulk entry, and future daily planning boundaries.

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
The system SHALL respect locked-period rules in the monthly work-log bulk entry view.

#### Scenario: Locked month is read-only for member
- **WHEN** a non-administrator opens monthly work-log entry for a locked month
- **THEN** the system displays the month as locked and prevents edits to daily work logs in that month

#### Scenario: Administrator edits locked month
- **WHEN** an administrator submits valid monthly work-log bulk edits for a locked month
- **THEN** the system allows the edits and stores the updated daily work logs

### Requirement: Daily allocation plan roadmap boundary
The system SHALL treat daily allocation plans as a future planning layer that is separate from actual daily work logs and focused on copying planned project allocations into actual effort entries.

#### Scenario: Daily plans are specified separately from v0.3 monthly planning
- **WHEN** daily allocation planning is proposed after v0.3
- **THEN** the system specifies it as project/day/member planned hours that can be compared with and copied into actual effort allocations

#### Scenario: Daily plans avoid attendance and payroll scope
- **WHEN** daily allocation planning is designed
- **THEN** the system keeps the scope limited to project effort planning and does not add attendance, payroll, leave management, or work-rule calculation features
