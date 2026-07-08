## Purpose

Define monthly period locking behavior for protecting finalized work-log and planning data.

## Requirements

### Requirement: Monthly period lock
The system SHALL allow administrators to lock a month after plans and actuals have been reviewed.

#### Scenario: Administrator locks month
- **WHEN** an administrator locks a target month
- **THEN** the system marks the month as locked and records who locked it and when

#### Scenario: Non-administrator attempts to lock month
- **WHEN** a non-administrator attempts to lock a month
- **THEN** the system denies the request

### Requirement: Locked period edit prevention
The system SHALL prevent non-administrator changes to monthly capacities, monthly plans, daily work logs, and allocations in locked months.

#### Scenario: Member edits locked allocation
- **WHEN** a member attempts to create, update, or delete an allocation in a locked month
- **THEN** the system rejects the change and explains that the month is locked

#### Scenario: Administrator edits locked period data
- **WHEN** an administrator edits monthly capacity, monthly plans, daily work logs, or allocations in a locked month
- **THEN** the system allows the change according to administrator permissions

### Requirement: Monthly period unlock
The system SHALL allow administrators to unlock a locked month when corrections are required.

#### Scenario: Administrator unlocks month
- **WHEN** an administrator unlocks a locked month
- **THEN** the system marks the month as open and records who unlocked it and when

#### Scenario: Non-administrator attempts to unlock month
- **WHEN** a non-administrator attempts to unlock a month
- **THEN** the system denies the request

### Requirement: Locked status visibility
The system SHALL show locked or open status for month-level screens and reports.

#### Scenario: Member views locked month
- **WHEN** a member opens a daily work-log or monthly plan view for a locked month
- **THEN** the system displays the locked status and disables non-administrator editing controls

#### Scenario: Administrator views locked month
- **WHEN** an administrator opens reports or month management for a locked month
- **THEN** the system displays the locked status and lock metadata
