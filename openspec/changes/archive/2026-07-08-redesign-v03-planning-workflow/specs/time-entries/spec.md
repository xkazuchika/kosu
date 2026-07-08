## ADDED Requirements

### Requirement: Daily allocation plan roadmap boundary
The system SHALL treat daily allocation plans as a future planning layer that is separate from actual daily work logs and focused on copying planned project allocations into actual effort entries.

#### Scenario: Daily plans are specified separately from v0.3 monthly planning
- **WHEN** daily allocation planning is proposed after v0.3
- **THEN** the system specifies it as project/day/member planned hours that can be compared with and copied into actual effort allocations

#### Scenario: Daily plans avoid attendance and payroll scope
- **WHEN** daily allocation planning is designed
- **THEN** the system keeps the scope limited to project effort planning and does not add attendance, payroll, leave management, or work-rule calculation features
