## ADDED Requirements

### Requirement: Hourly cost rate value validation
The system SHALL accept an administrator-managed member hourly cost rate only when it is empty or a non-negative safe integer amount in yen.

#### Scenario: Valid hourly cost rate is saved
- **WHEN** an administrator creates or updates a member with an empty, zero, or positive safe integer hourly cost rate
- **THEN** the system stores the empty value as unset or stores the supplied integer amount

#### Scenario: Invalid hourly cost rate is rejected
- **WHEN** an administrator submits a negative, fractional, non-numeric, non-finite, or unsafe-integer hourly cost rate
- **THEN** the system rejects the member write and preserves the previously stored member data

#### Scenario: Invalid rate cannot create a cost snapshot
- **WHEN** a member write containing an invalid hourly cost rate is rejected
- **THEN** later planned or actual effort cannot capture that invalid value as a cost-rate snapshot
