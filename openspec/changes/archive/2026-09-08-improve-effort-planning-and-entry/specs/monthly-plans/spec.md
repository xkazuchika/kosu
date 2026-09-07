## ADDED Requirements

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

