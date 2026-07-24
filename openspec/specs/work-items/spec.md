## Purpose

Define project, assignment, task, and lightweight project-financial planning boundaries.

## Requirements

### Requirement: Project management
The system SHALL allow administrators to create, update, archive, and list projects with unique project code, name, project type, optional client name, and optional description.

#### Scenario: Administrator creates project
- **WHEN** an administrator creates a project with a unique project code, name, project type, optional client name, and optional description
- **THEN** the system stores the project as active

#### Scenario: Duplicate project code is rejected
- **WHEN** an administrator creates or updates a project using a code already assigned to another project
- **THEN** the system rejects the request

### Requirement: Project type
The system SHALL classify projects as billable, internal, or non-billable.

#### Scenario: Administrator selects project type
- **WHEN** an administrator creates or updates a project
- **THEN** the system requires a project type of billable, internal, or non-billable

#### Scenario: Administrator archives project
- **WHEN** an administrator archives a project
- **THEN** the system prevents new time entries for that project while preserving historical entries

### Requirement: Project visibility
The system SHALL allow administrators to view all projects and non-administrators to view active projects assigned to them.

#### Scenario: Member views assigned active projects
- **WHEN** an authenticated member opens the project list
- **THEN** the system displays active project codes and names assigned to that member and available for effort allocation

#### Scenario: Member views archived project history
- **WHEN** a time entry references an archived project
- **THEN** the system still displays the archived project name in historical views

### Requirement: Project assignments
The system SHALL allow administrators to assign active members to active projects with an optional assignment role.

#### Scenario: Administrator assigns member to project
- **WHEN** an administrator assigns an active member to an active project with an optional assignment role
- **THEN** the system allows that member to allocate effort and monthly planned hours to that project and stores the assignment role

#### Scenario: Administrator removes project assignment
- **WHEN** an administrator removes a member's project assignment
- **THEN** the system prevents new effort allocations for that member and project while preserving historical plans and actuals

#### Scenario: Member attempts unassigned project entry
- **WHEN** a non-administrator attempts to allocate effort to an unassigned project
- **THEN** the system denies the request

#### Scenario: Administrator updates assignment role
- **WHEN** an administrator changes a member's assignment role for a project
- **THEN** the system uses the updated role for future monthly plans and reports while preserving historical plan and allocation records

### Requirement: Project self-assignment
The system SHALL allow authenticated members to assign only themselves to existing active projects.

#### Scenario: Member self-assigns active project
- **WHEN** a member searches for an existing active project that is not assigned to them and chooses self-assignment
- **THEN** the system creates an assignment for that member and project with source self-assigned

#### Scenario: Member self-assigns archived project
- **WHEN** a member attempts to self-assign an archived project
- **THEN** the system denies the request

#### Scenario: Member self-assigns another member
- **WHEN** a non-administrator attempts to assign another member to a project
- **THEN** the system denies the request

#### Scenario: Member self-assignment preserves master data
- **WHEN** a member self-assigns an existing active project
- **THEN** the system does not allow the member to change project name, code, type, client, or other administrator-managed fields

### Requirement: Assignment source visibility
The system SHALL expose assignment source to administrators.

#### Scenario: Administrator views self-assigned project
- **WHEN** an administrator opens assignment management or dashboard alerts
- **THEN** the system identifies assignments created by member self-assignment

### Requirement: Task management
The system SHALL allow administrators to manage tasks within projects.

#### Scenario: Administrator creates task
- **WHEN** an administrator creates a task with a name under an active project
- **THEN** the system stores the task as active and selectable for that project

#### Scenario: Administrator archives task
- **WHEN** an administrator archives a task
- **THEN** the system prevents new time entries for that task while preserving historical entries

### Requirement: Task selection
The system SHALL require each effort allocation to reference an active assigned project and MAY reference an active task within that project.

#### Scenario: Member selects project task
- **WHEN** a member creates an effort allocation and selects a task
- **THEN** the system accepts only tasks that belong to the selected project and are active

#### Scenario: Member omits task
- **WHEN** a member creates an effort allocation for an active assigned project without selecting a task
- **THEN** the system accepts the entry as project-level effort

### Requirement: Project financial planning roadmap boundary
The system SHALL support administrator-managed project contract revenue, labor cost budget, planned labor cost, actual labor cost, and direct-labor margin visibility for project tracking.

#### Scenario: Administrator configures project financial baseline
- **WHEN** an administrator creates or updates a project
- **THEN** the system allows separate optional contract revenue and labor cost budget records before financial review

#### Scenario: Project financial scope stays lightweight
- **WHEN** project financial planning is used
- **THEN** the system excludes invoicing, receivables, expense reimbursement, payroll, tax calculation, procurement, subcontractor cost, and ERP workflow from the scope
