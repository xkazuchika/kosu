## ADDED Requirements

### Requirement: Real calendar date validation
The system SHALL accept work dates and daily plan dates only when they are real Gregorian calendar dates in `YYYY-MM-DD` form and belong to the selected month where a month context is supplied.

#### Scenario: Impossible work date is rejected
- **WHEN** a user submits a daily or monthly-bulk effort write for a date such as `2026-02-31` or `2026-99-01`
- **THEN** the system rejects the write without storing or changing a work log or allocation

#### Scenario: Impossible daily plan date is rejected
- **WHEN** a user submits a daily allocation plan for a syntactically shaped but nonexistent calendar date
- **THEN** the system rejects the plan without storing or changing daily plan data

#### Scenario: Invalid weekly reference date is rejected
- **WHEN** a user opens or submits weekly effort entry with a nonexistent calendar reference date
- **THEN** the system rejects or replaces the invalid request context without deriving a different normalized week from that date

### Requirement: Daily effort upper bound
The system SHALL limit total working hours, every individual effort allocation, and the sum of active effort allocations for one member and work date to 24 hours while preserving warning-based balance handling within that limit.

#### Scenario: Total working hours over 24 are rejected
- **WHEN** a user submits total working hours greater than 24 through daily, weekly, or monthly-bulk entry
- **THEN** the system rejects the entire affected atomic submission without changing effort data

#### Scenario: Individual allocation over 24 is rejected
- **WHEN** a user submits an individual effort allocation greater than 24 hours
- **THEN** the system rejects the entry without storing the allocation

#### Scenario: Combined allocation total over 24 is rejected
- **WHEN** the submitted active allocation rows for one member and date total more than 24 hours
- **THEN** the system rejects the entry without partially changing that date

#### Scenario: Bounded imbalance remains allowed
- **WHEN** total working hours and total allocated hours are each at most 24 hours but do not match
- **THEN** the system saves otherwise valid values and displays the existing unallocated or overallocated warning

### Requirement: Cleared daily work log re-entry
The system SHALL allow a member/date combination cleared through zero-hour monthly bulk entry to be entered again without violating uniqueness or exposing the prior cleared row as active.

#### Scenario: Cleared day is entered again from monthly bulk entry
- **WHEN** a user clears a day with zero hours and later submits valid positive hours for the same member and date
- **THEN** the system stores one active work log for that member and date and displays the new hours

#### Scenario: Cleared day is entered again from daily entry
- **WHEN** a user clears a day and later saves a valid unified daily entry or total-working-hours-only entry for the same member and date
- **THEN** the system stores the new active state without a uniqueness error and without restoring deleted allocations

#### Scenario: Re-entry remains atomic
- **WHEN** re-entering a cleared day includes an invalid allocation
- **THEN** the system leaves the day cleared and does not partially reactivate the work log
