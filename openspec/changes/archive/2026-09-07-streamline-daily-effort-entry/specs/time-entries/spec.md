## ADDED Requirements

### Requirement: Unified daily entry form

The system SHALL let members record total working hours and every allocation row for a work date in a single form submission.

#### Scenario: Member saves the whole day at once

- **WHEN** a member submits the daily entry form with total working hours and one or more allocation rows
- **THEN** the system creates or updates the daily work log and creates, updates, and removes the submitted allocation rows together

#### Scenario: Blank new rows are offered for additional entries

- **WHEN** a member opens the daily entry form
- **THEN** the system renders several empty rows so additional allocations can be entered without an extra submission

#### Scenario: Empty rows are ignored

- **WHEN** a member submits rows that have no project and no allocated hours
- **THEN** the system ignores those rows without creating allocations or reporting an error

#### Scenario: Row is removed from the same form

- **WHEN** a member activates the remove control for an existing allocation row and submits
- **THEN** the system removes that allocation and leaves the remaining rows unchanged

#### Scenario: Invalid row prevents the whole submission

- **WHEN** a member submits the daily entry form containing any invalid row
- **THEN** the system rejects the entire submission, persists nothing, and reports the invalid row

### Requirement: Unallocated hours indicator

The system SHALL show how total working hours compare with allocated hours and SHALL NOT prefill allocation hours automatically.

#### Scenario: Hours remain unallocated

- **WHEN** allocated hours are less than total working hours
- **THEN** the system shows the unallocated remainder without prefilling any allocation row

#### Scenario: Allocations exceed total working hours

- **WHEN** allocated hours are greater than total working hours
- **THEN** the system shows the over-allocated amount

#### Scenario: Allocations match total working hours

- **WHEN** allocated hours equal total working hours
- **THEN** the system shows that the day is fully allocated

### Requirement: Total working hours only save

The system SHALL let members record total working hours for a work date without changing its allocation rows.

#### Scenario: Member records only total working hours

- **WHEN** a member submits the total-working-hours control for a work date
- **THEN** the system creates or updates the daily work log and leaves every allocation row unchanged

#### Scenario: Total working hours is invalid

- **WHEN** a member submits total working hours that are zero, negative, or not a 0.25 hour increment
- **THEN** the system rejects the submission and shows a validation error

#### Scenario: Work date has no work log yet

- **WHEN** a member submits total working hours for a work date that has no work log
- **THEN** the system creates the work log with no allocations

#### Scenario: Protected month is respected

- **WHEN** a member submits total working hours for an in-review or approved month
- **THEN** the system rejects the submission

### Requirement: Copy previous day effort

The system SHALL let members copy a previous day's total working hours and allocation rows into the current work date.

#### Scenario: Member copies the previous day

- **WHEN** a member requests a copy from the previous day and the current work date has no allocations
- **THEN** the system creates the daily work log and allocation rows matching the previous day's projects, tasks, hours, and notes

#### Scenario: Copy is refused when the day already has allocations

- **WHEN** a member requests a copy from the previous day and the current work date already has one or more allocations
- **THEN** the system refuses the copy, changes nothing, and reports that allocations already exist

#### Scenario: Previous day has no effort

- **WHEN** a member requests a copy from a previous day that has no work log or no allocations
- **THEN** the system reports that there is nothing to copy and changes nothing

#### Scenario: Unusable rows are skipped with a warning

- **WHEN** a member requests a copy from the previous day and some of its rows reference an archived or unassigned project
- **THEN** the system copies the usable rows, skips the rest, and reports how many rows were copied and which projects were skipped

#### Scenario: No usable row can be copied

- **WHEN** a member requests a copy from the previous day and none of its rows can be copied
- **THEN** the system changes nothing and reports that there is nothing to copy

### Requirement: Daily entry save feedback

The system SHALL confirm a successful daily entry save with the number of saved allocation rows.

#### Scenario: Save succeeds

- **WHEN** a member submits a valid daily entry form
- **THEN** the system reports success including how many allocation rows were saved

#### Scenario: Validation fails

- **WHEN** a member submits an invalid daily entry form
- **THEN** the system reports the validation error without implying that anything was saved

### Requirement: Recently used project ordering

The system SHALL order the project options in daily effort entry so projects the member used most recently appear first.

#### Scenario: Recently used project sorts first

- **WHEN** a member opens daily effort entry after recording effort on a project
- **THEN** that project appears ahead of assigned projects the member has not used recently

#### Scenario: Never-used projects keep a stable order

- **WHEN** a member opens daily effort entry
- **THEN** projects without recent effort appear after recently used ones in a stable order

## MODIFIED Requirements

### Requirement: Daily work log creation

The system SHALL allow authenticated members to record a daily work log with work date and total working hours as part of the unified daily entry submission.

#### Scenario: Member records daily working hours

- **WHEN** a member submits the daily entry form with a valid work date and positive total working hours
- **THEN** the system stores the daily work log for that member

#### Scenario: Invalid working hours are rejected

- **WHEN** a member submits the daily entry form with zero, negative, or otherwise invalid total working hours
- **THEN** the system rejects the submission and shows a validation error

#### Scenario: Working hours are no longer a separate prerequisite step

- **WHEN** a member submits allocation rows for a work date that has no saved work log yet
- **THEN** the system creates the work log and the allocations in the same submission instead of requiring a prior save
