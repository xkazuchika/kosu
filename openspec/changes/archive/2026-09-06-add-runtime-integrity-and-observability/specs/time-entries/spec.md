## MODIFIED Requirements

### Requirement: Daily work log and allocation editing
The system SHALL allow members to edit and delete their own daily work logs and allocations without silently changing the project an existing allocation references.

#### Scenario: Member edits own work log
- **WHEN** a member updates their own daily work log or allocation with valid values
- **THEN** the system persists the updated work log or allocation

#### Scenario: Member deletes own allocation
- **WHEN** a member deletes their own allocation
- **THEN** the system removes the allocation from active timesheet and report totals

#### Scenario: Entry screen offers a no-longer-assignable project
- **WHEN** a member opens effort entry for a date containing an allocation whose project is archived or no longer assigned to that member
- **THEN** the system displays that project as a selectable option with its archived or unassigned state instead of omitting it

#### Scenario: Edit keeps an unassignable project
- **WHEN** a member updates allocated hours or notes for an existing allocation without changing its project, and that project is archived or no longer assigned
- **THEN** the system persists the update while keeping the original project association

#### Scenario: Implicit project change is rejected
- **WHEN** a submission would change an existing allocation to a project that is archived or not assigned to the member
- **THEN** the system rejects the change with a validation error instead of accepting a different project

#### Scenario: Task reference is preserved
- **WHEN** a member updates an existing allocation whose task is archived
- **THEN** the system keeps the original task association unless the submission explicitly selects a different active task
