## ADDED Requirements

### Requirement: Valid workspace timezone
The system SHALL accept only timezone identifiers recognized by the runtime when creating or updating workspace settings.

#### Scenario: Administrator saves a valid timezone
- **WHEN** an administrator completes setup or updates settings with a recognized timezone such as `Asia/Tokyo`
- **THEN** the system stores the timezone for workspace calendar calculations

#### Scenario: Administrator submits an invalid timezone
- **WHEN** an administrator submits an unrecognized timezone identifier
- **THEN** the system rejects the change with a validation message and preserves the previous valid setting

#### Scenario: Existing installation contains an invalid timezone
- **WHEN** the application reads a legacy workspace timezone that the runtime cannot recognize
- **THEN** the system remains available, uses UTC as a safe calendar fallback, and exposes a configuration warning to administrators

### Requirement: Workspace-local calendar defaults
The system SHALL derive calendar concepts such as today and the current month from the workspace timezone at the request's reference time.

#### Scenario: Tokyo workspace opens during the UTC previous day
- **WHEN** an `Asia/Tokyo` workspace opens a today-oriented screen after local midnight while UTC is still on the previous date
- **THEN** the system uses the Tokyo calendar date for dashboard status and daily-entry navigation

#### Scenario: Workspace opens across a local month boundary
- **WHEN** the workspace-local date has entered a new month while UTC remains in the previous month
- **THEN** the system defaults work-log, planning, and report month selectors to the new workspace-local month

#### Scenario: Different workspace timezone is configured
- **WHEN** an administrator changes the workspace to another valid timezone
- **THEN** subsequent calendar defaults use that timezone without changing stored work dates or timestamps

### Requirement: Explicit calendar selection
The system SHALL preserve a user's explicitly selected valid work date or month instead of replacing it with the workspace calendar default.

#### Scenario: User selects a historical month
- **WHEN** a user opens a work-log, planning, or report workflow with a valid historical month
- **THEN** the system displays the selected month regardless of the current workspace-local month

#### Scenario: Calendar query is missing or invalid
- **WHEN** a calendar-oriented workflow receives no date or month, or receives an invalid value
- **THEN** the system falls back to the applicable workspace-local today or current month

### Requirement: UTC persistence timestamps
The system SHALL continue to store technical creation, update, archive, and session timestamps in UTC independently of the workspace calendar timezone.

#### Scenario: Workspace timezone changes
- **WHEN** an administrator changes the workspace timezone
- **THEN** existing and new technical timestamps retain UTC-based ordering and are not rewritten
