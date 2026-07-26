## MODIFIED Requirements

### Requirement: Monthly work-log lock handling
The system SHALL respect monthly close state in daily and monthly work-log mutation paths.

#### Scenario: Protected month is read-only for member
- **WHEN** a non-administrator opens monthly work-log entry for an in-review or approved month
- **THEN** the system displays the state and prevents edits to daily work logs and allocations in that month

#### Scenario: Protected month is read-only for administrator
- **WHEN** an administrator opens or submits daily or monthly work-log edits for an in-review or approved month
- **THEN** the system rejects edits and requires reopening the month before correction

## ADDED Requirements

### Requirement: Monthly close cannot be bypassed
The system SHALL apply the monthly close guard to every route and service that can change selected-month work-log or allocation data.

#### Scenario: Monthly bulk entry targets protected month
- **WHEN** a user submits monthly work-log totals for an in-review or approved month
- **THEN** the system rejects the entire submission without partial updates

#### Scenario: Daily-plan copy targets protected month
- **WHEN** a user copies daily plans to actuals for an in-review or approved month
- **THEN** the system rejects the copy before creating work logs or allocations

#### Scenario: Import targets protected month
- **WHEN** an administrator commits an import containing month-scoped data for an in-review or approved month
- **THEN** the system rejects affected rows or the atomic import according to the existing import transaction policy and reports the protected month
