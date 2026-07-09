## ADDED Requirements

### Requirement: Monthly and daily plan aggregation relationship
The system SHALL compare monthly planned effort and daily allocation plans by aggregation without directly linking their rows.

#### Scenario: Daily plans are compared with monthly plans
- **WHEN** a user opens daily allocation planning for a member and month
- **THEN** the system shows the member's monthly planned total, daily planned total, and the difference between them

#### Scenario: Monthly plan projects seed daily plan columns
- **WHEN** a member has monthly plans for the selected month
- **THEN** the system can include those projects as default daily plan columns without storing a link to monthly plan rows

#### Scenario: Monthly plan change does not rewrite daily plans
- **WHEN** monthly planned effort is created, updated, or deleted
- **THEN** the system does not automatically create, update, or delete daily allocation plans

#### Scenario: Daily plan change does not rewrite monthly plans
- **WHEN** daily allocation plans are created, updated, or deleted
- **THEN** the system does not automatically create, update, or delete monthly planned effort
