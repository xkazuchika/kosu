## ADDED Requirements

### Requirement: Member maintenance impact guidance
The system SHALL explain before member deactivation that login becomes unavailable while recorded effort is retained. Before saving member edits, it SHALL explain that current member names, departments, and operation permissions are reflected in historical effort reports without fixing historical affiliation or changing saved cost snapshots. Member management SHALL label account roles as 操作権限, with 管理者 and メンバー values, separately from project assignment roles.

#### Scenario: Administrator considers deactivation
- **WHEN** an administrator views the deactivation control for a member
- **THEN** the page explains the login restriction and preservation of recorded effort before the control is submitted
- **AND** the existing last-active-administrator protection remains enforced

#### Scenario: Administrator changes department
- **WHEN** an administrator edits a member's department, name, or operation permission
- **THEN** the page explains before saving that historical effort reports refer to current member master values
- **AND** the page does not imply that such changes rewrite recorded hours or saved cost snapshots

#### Scenario: Role label is unambiguous
- **WHEN** an administrator views member list, creation, or editing screens
- **THEN** the account-role field is labeled 操作権限 and is not presented as a project assignment role
