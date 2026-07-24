## ADDED Requirements

### Requirement: Supported report surfaces
The system SHALL expose report routes only for supported public capabilities and SHALL not retain obsolete preview routes from earlier release planning.

#### Scenario: User opens a supported effort report
- **WHEN** an authorized user opens the effort report or planned-versus-actual report
- **THEN** the system displays the supported report according to that user's access level

#### Scenario: Administrator opens project financial review
- **WHEN** an administrator opens the project financial review
- **THEN** the system displays the supported administrator-only direct-labor financial report

#### Scenario: User requests the obsolete resource planning preview
- **WHEN** a user requests `/reports/resource-planning`
- **THEN** the system returns a not-found response instead of displaying the old v0.1 or v0.2 preview

#### Scenario: User needs capacity comparison
- **WHEN** a user needs the currently supported monthly capacity, plan, and actual comparison
- **THEN** the system provides it through the planned-versus-actual report rather than an obsolete preview route
