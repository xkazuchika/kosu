## Purpose

Define CSV import and export behavior for setup, planning, and administrative data operations.

## Requirements

### Requirement: CSV templates
The system SHALL provide downloadable CSV templates for setup and planning imports.

#### Scenario: Administrator downloads import templates
- **WHEN** an administrator opens the import page
- **THEN** the system provides templates for members, projects, project assignments, monthly capacities, and monthly plans

#### Scenario: Non-administrator requests templates
- **WHEN** a non-administrator requests administrative import templates
- **THEN** the system denies the request

### Requirement: CSV import validation preview
The system SHALL validate imported CSV rows before committing changes, including verifying that every required template column is present in the uploaded header row.

#### Scenario: Administrator previews valid CSV
- **WHEN** an administrator uploads a valid CSV import file
- **THEN** the system displays a preview of rows that will be created or updated without committing them yet

#### Scenario: Administrator previews invalid CSV
- **WHEN** an administrator uploads a CSV import file with missing required fields, duplicate keys, invalid references, or invalid values
- **THEN** the system displays row-level validation errors and does not commit invalid rows

#### Scenario: Required template column is absent
- **WHEN** an administrator uploads a CSV import file whose header row omits a column required by the selected import type
- **THEN** the system reports the missing column by name and does not preview or commit any rows

#### Scenario: Required column is present but blank
- **WHEN** an administrator uploads a CSV import file where a required column exists but a row leaves it blank
- **THEN** the system reports the blank value as a row-level validation error distinct from a missing column

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

### Requirement: BOM-tolerant CSV import
The system SHALL accept UTF-8 CSV files with or without a byte order mark.

#### Scenario: Excel-style BOM CSV is parsed
- **WHEN** an administrator uploads a UTF-8 CSV file that begins with a byte order mark
- **THEN** the system parses the first column header correctly and previews rows without spurious header errors

### Requirement: Atomic CSV import commit
The system SHALL apply all rows of a confirmed import in a single transaction so the import either fully succeeds or fully fails.

#### Scenario: Import failure leaves no partial data
- **WHEN** an import commit encounters an error partway through applying rows
- **THEN** no rows from that import are persisted and the import job is reported as failed

#### Scenario: Successful import applies all rows
- **WHEN** an administrator confirms a fully validated import
- **THEN** all rows are created or updated together in one transaction

### Requirement: CSV export formula injection protection
The system SHALL neutralize exported CSV text values that could be interpreted as spreadsheet formulas.

#### Scenario: Formula-like text value is neutralized
- **WHEN** an exported text value begins with an equals sign, plus sign, hyphen, or at sign
- **THEN** the system prefixes the value so spreadsheet applications treat it as text instead of a formula

### Requirement: CSV import business-rule parity
The system SHALL apply the same domain, lifecycle, and relationship validation to CSV preview and commit that applies to equivalent interactive writes.

#### Scenario: Member import validates cost and active flag
- **WHEN** a member CSV row contains an invalid hourly cost rate or an `isActive` value other than the supported true and false forms
- **THEN** preview reports row-level errors and commit stores none of that row

#### Scenario: Assignment import validates active targets
- **WHEN** an assignment CSV row refers to an inactive member or archived project
- **THEN** preview reports a row-level error and commit does not create an active assignment

#### Scenario: Capacity import validates active member
- **WHEN** a monthly-capacity CSV row refers to an inactive member
- **THEN** preview reports a row-level error and commit does not create or update capacity

#### Scenario: Monthly plan import validates eligibility
- **WHEN** a monthly-plan CSV row refers to an inactive member, archived project, or project not actively assigned to that member
- **THEN** preview reports a row-level error and commit does not create or update the plan

#### Scenario: Commit revalidates previewed rows
- **WHEN** referenced member, project, assignment, or monthly-close state changes after preview but before commit
- **THEN** commit revalidates the rows inside the atomic operation and stores no partial import when any row is no longer valid

### Requirement: Project effort budget CSV parity
The system SHALL include the optional project effort budget in project CSV templates, imports, and administrative exports with the same validation as project forms.

#### Scenario: Project effort budget round-trips through CSV
- **WHEN** an administrator exports projects and imports the resulting supported fields
- **THEN** each valid optional effort budget is preserved in 0.25-hour increments

#### Scenario: Invalid imported effort budget is rejected
- **WHEN** a project CSV row contains a negative, non-numeric, or non-quarter-hour effort budget
- **THEN** preview reports a row-level error and commit stores none of that row

#### Scenario: Older project CSV remains accepted
- **WHEN** a project CSV uses the previously supported headers without the optional effort-budget column
- **THEN** the system continues to validate and import the row without clearing an existing effort budget solely because that optional column is absent
