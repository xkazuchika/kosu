## ADDED Requirements

### Requirement: Monthly plans as planning source
The system SHALL use monthly capacities and monthly planned effort as the v0.2 planning source for planned-versus-actual views.

#### Scenario: Plan data feeds planned-versus-actual view
- **WHEN** a user opens a planned-versus-actual view for a month
- **THEN** the system uses monthly capacity and monthly planned effort for that month as the planned side of the comparison

#### Scenario: Missing plans show guidance
- **WHEN** a planned-versus-actual view has capacity or actuals but no monthly planned effort
- **THEN** the system displays a clear empty or partial-planning state with guidance to create monthly plans
