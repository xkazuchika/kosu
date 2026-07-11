## MODIFIED Requirements

### Requirement: Dashboard navigation
The system SHALL link dashboard summaries to the related operational pages.

#### Scenario: Administrator follows incomplete allocation summary
- **WHEN** an administrator selects the incomplete allocation summary
- **THEN** the system opens the related allocation completeness report or filtered work-log view

#### Scenario: Member follows input status
- **WHEN** a member selects today's input status
- **THEN** the system opens that member's daily work-log entry page for today

#### Scenario: Member follows current-month allocation warning
- **WHEN** a member selects the current-month incomplete allocation summary or warning
- **THEN** the system opens that member's work-log list filtered to the current month and unbalanced entries
