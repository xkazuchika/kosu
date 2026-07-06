## ADDED Requirements

### Requirement: CSV templates
The system SHALL provide downloadable CSV templates for setup and planning imports.

#### Scenario: Administrator downloads import templates
- **WHEN** an administrator opens the import page
- **THEN** the system provides templates for members, projects, project assignments, monthly capacities, and monthly plans

#### Scenario: Non-administrator requests templates
- **WHEN** a non-administrator requests administrative import templates
- **THEN** the system denies the request

### Requirement: CSV import validation preview
The system SHALL validate imported CSV rows before committing changes.

#### Scenario: Administrator previews valid CSV
- **WHEN** an administrator uploads a valid CSV import file
- **THEN** the system displays a preview of rows that will be created or updated without committing them yet

#### Scenario: Administrator previews invalid CSV
- **WHEN** an administrator uploads a CSV import file with missing required fields, duplicate keys, invalid references, or invalid values
- **THEN** the system displays row-level validation errors and does not commit invalid rows

### Requirement: CSV import commit
The system SHALL commit CSV imports only after administrator confirmation.

#### Scenario: Administrator confirms valid import
- **WHEN** an administrator confirms a validated CSV import preview
- **THEN** the system creates or updates the imported records and records the import result

#### Scenario: Non-administrator attempts import
- **WHEN** a non-administrator attempts to import CSV data
- **THEN** the system denies the request

### Requirement: Importable setup data
The system SHALL support importing members, projects, project assignments, monthly capacities, and monthly plans.

#### Scenario: Project import uses project code
- **WHEN** a project CSV row contains a project code, name, and project type
- **THEN** the system uses the project code as the stable key for creating or updating the project

#### Scenario: Assignment import uses stable keys
- **WHEN** an assignment CSV row references member email and project code
- **THEN** the system resolves those keys to the corresponding member and project

### Requirement: Administrative CSV export
The system SHALL allow administrators to export setup and planning data as CSV.

#### Scenario: Administrator exports master data
- **WHEN** an administrator exports members, projects, assignments, monthly capacities, or monthly plans
- **THEN** the system downloads a CSV containing the selected records with administrator-visible fields

#### Scenario: Non-administrator exports master data
- **WHEN** a non-administrator requests an administrative master-data export
- **THEN** the system denies the request
