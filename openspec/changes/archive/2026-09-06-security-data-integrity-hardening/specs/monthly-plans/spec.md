## ADDED Requirements

### Requirement: Monthly plan response field masking
The system SHALL not include member credential or financial fields in monthly plan and capacity screen responses.

#### Scenario: Member monthly plan view excludes credential and cost fields
- **WHEN** a member loads their monthly plan view
- **THEN** the response contains no member password hash or hourly cost rate values

#### Scenario: Administrator capacity view excludes credential fields
- **WHEN** an administrator loads the monthly capacity management screen
- **THEN** the response contains member identifiers and display names but no member password hash values

### Requirement: Monthly plan and capacity value validation
The system SHALL accept monthly planned hours and capacity hours only as non-negative values in 0.25 hour increments, and target months only as real calendar months.

#### Scenario: Non-quarter-hour monthly hours are rejected
- **WHEN** an administrator submits monthly planned hours or capacity hours that are not divisible by 0.25 hours
- **THEN** the system rejects the submission and shows a validation error

#### Scenario: Invalid calendar month is rejected at entry
- **WHEN** a submission targets a month string such as 2026-13 that is not a real calendar month
- **THEN** the system rejects the submission with a validation error at entry time instead of failing during a later processing step
