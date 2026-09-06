## ADDED Requirements

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
