## ADDED Requirements

### Requirement: Project-first planning workflow
The system SHALL present monthly planning as project planned effort entry first, with capacity shown as optional context.

#### Scenario: Administrator opens monthly planning
- **WHEN** an administrator opens the monthly planning input screen
- **THEN** the system emphasizes project planned effort fields before optional member capacity controls

#### Scenario: User sees capacity context
- **WHEN** capacity is shown on planning or reporting screens
- **THEN** the system labels it as optional capacity context rather than required planned effort

### Requirement: Editable monthly plan rows
The system SHALL make existing monthly project plan rows visibly editable and deletable.

#### Scenario: Administrator edits existing plan row
- **WHEN** an administrator views monthly project plans
- **THEN** each existing plan row provides controls to update planned hours, assignment role, and delete the row

### Requirement: v0.3 planning UI consistency
The system SHALL keep v0.3 planning screens consistent by exposing target-month selection, avoiding stale fixed header labels, and using consistent planning terminology.

#### Scenario: User switches target month on monthly planning screens
- **WHEN** a user opens a monthly planning screen
- **THEN** the system provides a target-month control that reloads the screen for the selected month

#### Scenario: User sees planning navigation appropriate to their role
- **WHEN** a non-administrator opens their monthly planning screen
- **THEN** the system does not show administrator-only monthly planning input links

#### Scenario: User sees consistent v0.3 planning labels
- **WHEN** a user opens v0.3 monthly planning or planned-versus-actual screens
- **THEN** the system avoids stale version badges and uses consistent labels for monthly plans and planned effort

#### Scenario: User performs destructive planning actions
- **WHEN** an administrator sees controls that delete monthly planning data
- **THEN** the system styles destructive actions distinctly from save actions
