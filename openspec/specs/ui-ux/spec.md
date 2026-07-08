## Purpose

Define the product UI direction, role-aware navigation, and planning workflow usability expectations.

## Requirements

### Requirement: Application shell
The system SHALL provide a consistent authenticated application shell with role-aware navigation.

#### Scenario: Member views navigation
- **WHEN** a non-administrator signs in
- **THEN** the system displays navigation for dashboard, work logs, monthly plans, assigned projects, personal reports, and profile without administrator-only management links

#### Scenario: Administrator views navigation
- **WHEN** an administrator signs in
- **THEN** the system displays navigation for dashboard, work logs, monthly plans, projects, members, reports, import/export, and settings

### Requirement: Visual direction
The system SHALL use a lightweight OSS tool visual style with business-app clarity.

#### Scenario: User opens authenticated page
- **WHEN** a user opens an authenticated page
- **THEN** the system displays a neutral, readable interface using restrained accent color, consistent spacing, compact cards, clear tables, and visible primary actions

#### Scenario: Page contains status or warnings
- **WHEN** a page contains missing input, unallocated hours, overplanned capacity, locked period, or self-assignment state
- **THEN** the system displays clear status badges or warnings without relying on color alone

### Requirement: Japanese-first interface
The system SHALL provide Japanese-first UI copy for the MVP.

#### Scenario: User opens application page
- **WHEN** a user opens an MVP application page
- **THEN** primary labels, navigation, form actions, validation messages, and empty-state guidance are displayed in Japanese

#### Scenario: Public repository visitor reads overview
- **WHEN** a visitor opens the README
- **THEN** the README provides Japanese-first documentation with an English summary

### Requirement: Daily input usability
The system SHALL optimize daily work-log entry for fast allocation input.

#### Scenario: Member enters daily effort
- **WHEN** a member opens the daily work-log screen
- **THEN** the system emphasizes work date, total working hours, project allocation rows, allocated total, and unallocated or overallocated difference

#### Scenario: Member uses small screen
- **WHEN** a member opens the daily work-log screen on a mobile-sized viewport
- **THEN** the system keeps daily input usable without horizontal scrolling for the core work-date, total-hours, project, allocated-hours, and save controls

### Requirement: Administration table usability
The system SHALL provide readable table and filter patterns for administration and reporting screens.

#### Scenario: Administrator manages master data
- **WHEN** an administrator opens member, project, assignment, import, or report pages
- **THEN** the system provides searchable or filterable tables with clear empty states and row-level actions

### Requirement: Empty states and onboarding cues
The system SHALL provide clear empty states that guide first-time setup and trial usage.

#### Scenario: Setup data is missing
- **WHEN** a page has no members, projects, assignments, monthly plans, or work logs
- **THEN** the system explains what is missing and links to the relevant create, import, or demo-seed guidance when available

### Requirement: Public repository screenshot readiness
The system SHALL include visually coherent pages suitable for public repository screenshots.

#### Scenario: Demo data is loaded
- **WHEN** demo seed data exists
- **THEN** dashboard, daily work-log, monthly planning, project, and report screens display representative data without exposing real secrets or credentials

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

### Requirement: Project-first planning workflow
The system SHALL present monthly planning as project planned effort entry first, with capacity shown as optional context.

#### Scenario: Administrator opens monthly planning
- **WHEN** an administrator opens the monthly planning input screen
- **THEN** the system emphasizes project planned effort fields before optional member capacity controls

#### Scenario: User sees capacity context
- **WHEN** capacity is shown on planning or reporting screens
- **THEN** the system labels it as optional capacity context rather than required planned effort

### Requirement: Editable monthly plan rows
The system SHALL make existing monthly project plan rows visibly editable and deletable.

#### Scenario: Administrator edits existing plan row
- **WHEN** an administrator views monthly project plans
- **THEN** each existing plan row provides controls to update planned hours, assignment role, and delete the row

### Requirement: v0.3 planning UI consistency
The system SHALL keep v0.3 planning screens consistent by exposing target-month selection, avoiding stale fixed header labels, and using consistent planning terminology.

#### Scenario: User switches target month on monthly planning screens
- **WHEN** a user opens a monthly planning screen
- **THEN** the system provides a target-month control that reloads the screen for the selected month

#### Scenario: User sees planning navigation appropriate to their role
- **WHEN** a non-administrator opens their monthly planning screen
- **THEN** the system does not show administrator-only monthly planning input links

#### Scenario: User sees consistent v0.3 planning labels
- **WHEN** a user opens v0.3 monthly planning or planned-versus-actual screens
- **THEN** the system avoids stale version badges and uses consistent labels for monthly plans and planned effort

#### Scenario: User performs destructive planning actions
- **WHEN** an administrator sees controls that delete monthly planning data
- **THEN** the system styles destructive actions distinctly from save actions

## Future Scope (v0.3+)

- UI patterns for financial reporting and profitability analysis are outside the v0.2 public scope.
