## ADDED Requirements

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
