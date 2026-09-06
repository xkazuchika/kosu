## ADDED Requirements

### Requirement: Monthly work-log bulk entry atomicity
The system SHALL apply all day totals of a monthly work-log bulk entry submission in a single transaction.

#### Scenario: Validation failure prevents partial saves
- **WHEN** a monthly bulk entry submission contains an invalid day value after one or more valid day values
- **THEN** the system rejects the submission without persisting any of the day totals

### Requirement: Zero-hour clearing in monthly bulk entry
The system SHALL let users clear a mistakenly entered daily total by submitting zero in monthly bulk entry when that day has no effort allocations.

#### Scenario: Zero clears a day without allocations
- **WHEN** a user submits zero total working hours for a date whose work log has no effort allocations
- **THEN** the system removes the daily work log for that date

#### Scenario: Zero is rejected for a day with allocations
- **WHEN** a user submits zero total working hours for a date whose work log has one or more effort allocations
- **THEN** the system rejects the value and shows an error directing the user to remove the allocations first

### Requirement: Planned-to-actual copy atomicity
The system SHALL apply a planned-to-actual copy for a month in a single transaction.

#### Scenario: Copy failure leaves no partial actuals
- **WHEN** a planned-to-actual copy encounters an error partway through creating work logs and allocations
- **THEN** no work logs or allocations from that copy are persisted
