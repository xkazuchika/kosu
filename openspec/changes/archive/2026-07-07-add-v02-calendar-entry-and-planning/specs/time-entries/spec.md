## ADDED Requirements

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
