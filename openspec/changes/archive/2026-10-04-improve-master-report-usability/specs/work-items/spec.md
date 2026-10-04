## ADDED Requirements

### Requirement: Project maintenance impact guidance
The system SHALL explain before archiving a project that new effort entry becomes unavailable while historical effort is retained and remains reportable. Before saving project edits, it SHALL explain that current project code, name, and type are reflected in historical effort reports rather than preserving historical classifications.

#### Scenario: Administrator considers archiving
- **WHEN** an administrator views the archive control on a project edit page
- **THEN** the page explains the new-entry restriction and preservation of historical effort before submission

#### Scenario: Administrator changes project classification
- **WHEN** an administrator edits a project code, name, or type
- **THEN** the page explains before saving that historical effort-report labels and classification use current master values
- **AND** the change does not rewrite recorded hours or saved cost snapshots

### Requirement: Consistent project master terminology
The system SHALL use 請求対象, 社内作業, and 非請求 as project-type labels for billable, internal, and non_billable on project list, creation, and editing screens, while preserving stored codes. Assignment management SHALL describe the optional assignment role as 案件内の役割 rather than operation permission.

#### Scenario: Project type display and persistence
- **WHEN** an administrator selects 社内作業 on a project form and saves
- **THEN** the system retains the internal project-type code and displays 社内作業 on the project list and edit page

#### Scenario: Assignment role remains independent
- **WHEN** an administrator edits 案件内の役割 for an assignment
- **THEN** the system retains its existing free-text behavior without changing the member's operation permission
