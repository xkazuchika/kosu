## MODIFIED Requirements

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
