## ADDED Requirements

### Requirement: Monthly entry navigation
The system SHALL provide clear navigation between daily entry, monthly bulk entry, monthly plans, and planned-versus-actual reports.

#### Scenario: User navigates effort workflow
- **WHEN** an authenticated user opens work-log or planning pages
- **THEN** the system provides visible links to monthly bulk entry, daily detail entry, monthly plans, and planned-versus-actual reports according to the user's permissions

### Requirement: Calendar-like monthly entry usability
The system SHALL present monthly work-log bulk entry in a calendar-like form that remains usable on desktop and mobile screens.

#### Scenario: User edits monthly entries on desktop
- **WHEN** a user opens monthly work-log bulk entry on a desktop-sized viewport
- **THEN** the system shows the month in a compact table with one row per day and clear status badges for missing, incomplete, complete, overallocated, and locked days

#### Scenario: User edits monthly entries on mobile
- **WHEN** a user opens monthly work-log bulk entry on a mobile-sized viewport
- **THEN** the system keeps date, total-hours input, status, and daily detail link usable without requiring horizontal scrolling for core actions
