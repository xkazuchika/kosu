## ADDED Requirements

### Requirement: Project effort budget
The system SHALL allow administrators to store an optional project-wide effort budget as a non-negative number of hours in 0.25-hour increments, independently of contract revenue and labor-cost budget.

#### Scenario: Administrator sets an effort budget
- **WHEN** an administrator creates or updates a project with a valid effort budget
- **THEN** the system stores the effort budget without changing the project's financial baselines

#### Scenario: Administrator leaves effort budget empty
- **WHEN** an administrator creates or updates a project without an effort budget
- **THEN** the system keeps the project usable for plans and actuals without treating the missing value as zero

#### Scenario: Invalid effort budget is rejected
- **WHEN** an administrator submits a negative, non-numeric, or non-quarter-hour effort budget
- **THEN** the system rejects the project submission and shows a validation error

#### Scenario: Internal project omits effort budget
- **WHEN** an internal or non-billable project is saved without an effort budget
- **THEN** the system accepts the project without a budget-completeness warning

