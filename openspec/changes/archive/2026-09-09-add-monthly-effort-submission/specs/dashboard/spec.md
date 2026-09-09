## ADDED Requirements

### Requirement: Monthly submission dashboard status
The system SHALL present role-appropriate monthly effort submission status and next actions on the dashboard.

#### Scenario: Member sees own submission status
- **WHEN** a non-administrator opens the dashboard
- **THEN** the system shows whether the current month is draft or submitted and links draft state to the monthly effort review and submission workflow

#### Scenario: Administrator sees team submission summary
- **WHEN** an administrator opens the dashboard
- **THEN** the system shows submitted and required member counts for the current month and identifies required members who remain draft

#### Scenario: Administrator follows incomplete submission
- **WHEN** an administrator selects a draft member from the submission summary
- **THEN** the system opens that member's monthly work-log review context so the administrator can inspect balance and submit when authorized

#### Scenario: Zero-hour submission is complete
- **WHEN** a required member has submitted a month with no saved effort
- **THEN** the dashboard counts the member as submitted rather than missing input
