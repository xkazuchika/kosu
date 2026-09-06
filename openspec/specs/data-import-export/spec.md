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
