## ADDED Requirements

### Requirement: Persisted monthly submission domain integrity
The system SHALL persist monthly effort submissions only for a real `YYYY-MM` calendar month and with a supported draft or submitted status, rejecting malformed values at the persistence boundary.

#### Scenario: Unsupported submission status is persisted
- **WHEN** a write attempts to persist a monthly effort submission status other than draft or submitted
- **THEN** the system rejects the write without creating or changing the submission row

#### Scenario: Invalid submission month is persisted
- **WHEN** a write attempts to persist a monthly effort submission with a malformed month or a month number outside 01 through 12
- **THEN** the system rejects the write without creating or changing the submission row

#### Scenario: Existing valid submissions are upgraded
- **WHEN** the integrity constraints are introduced on a database containing valid draft, submitted, and legacy submission rows
- **THEN** the system preserves those rows and their actor, timestamp, invalidation, and migration metadata
