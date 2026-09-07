## ADDED Requirements

### Requirement: Interactive multi-row daily allocation entry
The system SHALL allow a user to add, edit, and remove multiple allocation rows in one daily-entry draft and submit the daily work log and final allocation set once.

#### Scenario: Member enters several projects before saving
- **WHEN** a member adds multiple assigned project rows with valid hours and submits the day
- **THEN** the system persists the daily total and all allocation changes atomically in one submission

#### Scenario: Member removes an existing row in the draft
- **WHEN** a member marks an existing allocation row for removal and saves a valid daily draft
- **THEN** the system removes that allocation as part of the same atomic submission

#### Scenario: Submission contains an invalid row
- **WHEN** any row in a daily draft has invalid hours or an ineligible project or task
- **THEN** the system rejects the whole submission without partially changing the work log or allocations

### Requirement: Live daily allocation balance
The daily-entry screen SHALL update allocated, unallocated, and overallocated hours from the unsaved draft as the user edits total working hours or allocation rows.

#### Scenario: Draft allocations equal actual working time
- **WHEN** the draft allocation sum equals the draft total working hours
- **THEN** the screen indicates that the day is fully allocated before submission

#### Scenario: Draft has remaining time
- **WHEN** the draft allocation sum is less than the draft total working hours
- **THEN** the screen shows the remaining number of hours and allows the user to assign the remainder to an eligible row

#### Scenario: Daily total differs from eight hours
- **WHEN** the user enters a valid daily total such as 5, 8, or 9.5 hours
- **THEN** the balance uses that entered actual total without enforcing an eight-hour default or ceiling

### Requirement: Project-scoped task choices
The daily and weekly entry screens SHALL offer only tasks belonging to the project selected on the same allocation row, while preserving referenced archived tasks on historical rows.

#### Scenario: Member selects a project
- **WHEN** a member chooses an active assigned project on a new allocation row
- **THEN** the task control offers only active tasks for that project

#### Scenario: Existing row references an archived task
- **WHEN** an existing allocation references an archived task
- **THEN** the screen keeps that task visible on the historical row unless the user explicitly changes it

### Requirement: Daily entry starting points
The system SHALL allow users to populate an unsaved daily-entry draft from the selected date's saved daily plan or from the most recent earlier workday with usable allocations.

#### Scenario: Member uses the selected date's plan
- **WHEN** a member requests a draft from a saved daily plan on a day without actual allocations
- **THEN** the screen populates project hours from the plan and lets the member review or edit them before saving

#### Scenario: Member copies the most recent usable workday
- **WHEN** a member requests a recent-workday draft on a day without actual allocations
- **THEN** the system finds the nearest earlier day with eligible allocations, skipping intervening days without allocations, and populates an editable draft

#### Scenario: Target day already has allocations
- **WHEN** a user requests a starting point for a day with saved actual allocations
- **THEN** the system does not overwrite those allocations implicitly

### Requirement: Weekly actual-effort entry
The system SHALL provide a weekly entry view with one column per date and reusable project, optional task, and optional note rows for entering actual allocations across the week.

#### Scenario: Member opens weekly entry
- **WHEN** a member selects a week
- **THEN** the system displays the seven dates from Monday through Sunday, each date's actual total working hours, allocation total, and editable allocation cells

#### Scenario: Member saves several days
- **WHEN** a member submits a valid weekly draft containing changes for several dates
- **THEN** the system persists all submitted daily work logs and allocations atomically

#### Scenario: Weekly submission includes an invalid day
- **WHEN** any changed date has invalid hours, an ineligible work item, or allocations that cannot be resolved safely
- **THEN** the system rejects the whole weekly submission and identifies the affected date without partial updates

#### Scenario: Weekly view targets a protected month
- **WHEN** any changed date belongs to an in-review or approved month
- **THEN** the system rejects the entire submission before changing any date

### Requirement: Entry navigation and preservation
The system SHALL make daily and weekly entry reachable from the primary actual-effort workflow and SHALL preserve unsaved draft values when server validation returns an error.

#### Scenario: User switches actual-entry mode
- **WHEN** a user opens actual-effort entry
- **THEN** the interface provides direct navigation between daily and weekly entry

#### Scenario: Server rejects a draft
- **WHEN** a daily or weekly submission fails validation
- **THEN** the screen shows the error and retains the submitted draft values for correction

