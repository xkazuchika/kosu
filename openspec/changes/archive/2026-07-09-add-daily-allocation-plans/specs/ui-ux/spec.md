## ADDED Requirements

### Requirement: Horizontal daily allocation plan input
The system SHALL provide a monthly daily allocation planning UI that supports fast project-level planned-hours entry.

#### Scenario: User opens daily allocation planning
- **WHEN** a user opens daily allocation planning for a month
- **THEN** the system shows target month controls, the relevant target member controls, summary totals, and a daily plan input grid

#### Scenario: Grid shows dates and projects
- **WHEN** daily allocation planning data is displayed on desktop
- **THEN** the system presents dates as rows, projects as columns, and planned-hours inputs as cells

#### Scenario: Grid uses relevant project columns
- **WHEN** a user opens daily allocation planning
- **THEN** the system includes columns for projects with monthly plans or existing daily plans and allows adding active assigned projects

#### Scenario: Empty and zero cell copy is clear
- **WHEN** a user edits daily allocation plan cells
- **THEN** the system communicates that empty or zero means no plan and positive values save planned hours

#### Scenario: Mobile daily plan input remains usable
- **WHEN** a user opens daily allocation planning on a mobile-sized viewport
- **THEN** the system keeps date, project, planned-hours input, and save actions usable through horizontal scrolling or compact per-day sections

### Requirement: Planned-to-actual copy feedback
The system SHALL provide clear feedback for planned-to-actual copy results.

#### Scenario: Copy result is shown
- **WHEN** a user runs planned-to-actual copy from daily allocation plans
- **THEN** the system shows how many dates and allocations were copied and how many dates were skipped

#### Scenario: Existing actuals are protected in copy UI
- **WHEN** planned-to-actual copy skips dates because actual allocations already exist
- **THEN** the system explains that existing actual allocations were left unchanged

### Requirement: Planned and actual effort workflow clarity
The system SHALL clearly distinguish planned effort entry from actual effort entry in navigation, page titles, and action buttons.

#### Scenario: User sees actual effort workflow labels
- **WHEN** a user opens work-log entry screens
- **THEN** the system labels them as actual effort entry and uses button labels that describe whether the user is saving total working hours or project-level actual effort

#### Scenario: User sees planned effort workflow labels
- **WHEN** a user opens daily allocation planning screens
- **THEN** the system labels them as planned effort entry and keeps save actions separate from copy-to-actual actions

#### Scenario: User copies saved plans to actuals
- **WHEN** a user sees the copy-to-actual action
- **THEN** the system explains that only saved daily plans are copied and unsaved cell edits must be saved first

#### Scenario: User sees grouped effort navigation
- **WHEN** a user opens the authenticated application shell
- **THEN** the system groups navigation by workflow sections such as input, reports, projects, and administration so planned and actual effort workflows are easier to distinguish

#### Scenario: User sees consistent effort terminology
- **WHEN** a user views navigation, page titles, buttons, tables, and report labels
- **THEN** the system uses total working hours for daily or monthly totals, planned effort for plan hours, and actual effort for project-level actual hours consistently
