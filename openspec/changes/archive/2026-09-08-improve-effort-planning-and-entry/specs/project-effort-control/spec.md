## Purpose

Define project-wide effort budgets and the hour-based indicators that connect member plans, daily actuals, remaining project effort, and direct-labor planning.

## ADDED Requirements

### Requirement: Project effort overview
The system SHALL provide an administrator with an effort overview for each project that has an effort budget, using all saved monthly plans and active effort allocations for that project.

#### Scenario: Administrator reviews project effort
- **WHEN** an administrator opens a project with an effort budget
- **THEN** the system displays the effort budget, total member-planned hours, total actual hours, unallocated budget hours, remaining actual hours, and actual consumption rate

#### Scenario: Project has no effort budget
- **WHEN** an administrator opens a project without an effort budget
- **THEN** the system displays planned and actual hours without presenting a fabricated budget balance or consumption rate

### Requirement: Effort indicator calculations
The system SHALL calculate unallocated budget hours as effort budget minus total planned hours and remaining actual hours as effort budget minus total actual hours.

#### Scenario: Plan remains within budget
- **WHEN** a 400-hour project has 250 planned hours and 170 actual hours
- **THEN** the system reports 150 unallocated budget hours, 230 remaining actual hours, and 42.5 percent actual consumption

#### Scenario: Planned or actual effort exceeds budget
- **WHEN** planned or actual project hours exceed the configured effort budget
- **THEN** the system displays the negative balance and an over-budget warning without rejecting otherwise valid plans or time entries

#### Scenario: Zero-hour effort budget
- **WHEN** a project has a zero-hour effort budget
- **THEN** the system displays the hour differences without dividing by zero or presenting an invalid consumption rate

### Requirement: Member project effort context
The system SHALL allow a member to see their own planned, actual, and remaining assigned hours for projects assigned to them without exposing other members' plans or financial data.

#### Scenario: Member enters effort for an assigned project
- **WHEN** a member views an assigned project during actual-effort entry
- **THEN** the system may display that member's planned hours, actual hours, and plan balance for the relevant month

#### Scenario: Member requests project financial context
- **WHEN** a non-administrator loads effort-entry data
- **THEN** the response excludes hourly cost rates, planned labor cost, actual labor cost, contract revenue, and labor-cost budget

### Requirement: Planned labor cost follows assignments
The system SHALL continue to calculate planned labor cost from member monthly planned hours and their saved hourly-cost-rate snapshots, independently of the project effort budget.

#### Scenario: Project hours are assigned to members with different rates
- **WHEN** an administrator reviews project planning with saved member monthly plans
- **THEN** the system calculates known planned labor cost from each plan's hours and rate snapshot rather than converting the project effort budget using one common rate

#### Scenario: Some budget hours are not assigned
- **WHEN** an effort budget contains hours that have not been assigned through member monthly plans
- **THEN** the system reports those hours as unallocated and does not invent a monetary cost for them

