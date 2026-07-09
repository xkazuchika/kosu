## ADDED Requirements

### Requirement: Planned-versus-actual source remains monthly plans
The system SHALL keep the existing planned-versus-actual report based on monthly planned effort while daily allocation plans are introduced.

#### Scenario: Planned-versus-actual report uses monthly plans
- **WHEN** a user opens the existing planned-versus-actual report after daily allocation plans exist
- **THEN** the system continues to use monthly planned effort as the planned side of the comparison

#### Scenario: Daily plan differences are shown outside existing report
- **WHEN** a user needs to compare daily plan totals with monthly planned totals
- **THEN** the system shows that comparison in the daily allocation planning workflow rather than changing the existing planned-versus-actual report semantics
