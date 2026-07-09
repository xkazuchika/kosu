## Purpose

Provide role-aware dashboard summaries for monthly effort, planning, and operational status.

## Requirements

### Requirement: Member dashboard
The system SHALL provide a role-appropriate dashboard after login for non-administrator members.

#### Scenario: Member opens dashboard
- **WHEN** a non-administrator signs in
- **THEN** the system displays today's input status, current-month planned hours, current-month actual hours, allocation warnings, and assigned projects

#### Scenario: Member has incomplete daily allocation
- **WHEN** a member has a daily work log whose allocations do not match total working hours
- **THEN** the dashboard displays an incomplete allocation warning for that member

### Requirement: Administrator dashboard
The system SHALL provide an administrator dashboard with lightweight operational summaries.

#### Scenario: Administrator opens dashboard
- **WHEN** an administrator signs in
- **THEN** the system displays team input status, incomplete allocations, self-assigned project alerts, overplanned members, project effort summaries, and locked-period status

#### Scenario: Administrator reviews self-assignment alert
- **WHEN** a member has self-assigned to a project
- **THEN** the administrator dashboard displays the member, project, and assignment date for review

### Requirement: Dashboard empty states
The system SHALL display useful empty states on dashboards when setup or work data is missing.

#### Scenario: No projects exist
- **WHEN** an administrator opens the dashboard before any projects exist
- **THEN** the system displays guidance to create or import projects

#### Scenario: Member has no assigned projects
- **WHEN** a member opens the dashboard without active project assignments
- **THEN** the system displays a clear no-assigned-projects state

### Requirement: Dashboard navigation
The system SHALL link dashboard summaries to the related operational pages.

#### Scenario: Administrator follows incomplete allocation summary
- **WHEN** an administrator selects the incomplete allocation summary
- **THEN** the system opens the related allocation completeness report or filtered work-log view

#### Scenario: Member follows input status
- **WHEN** a member selects today's input status
- **THEN** the system opens that member's daily work-log entry page for today

### Requirement: Dashboard next-action guidance
The system SHALL present the dashboard as a role-aware starting point that highlights what the user should do next.

#### Scenario: Member sees today's next action
- **WHEN** a non-administrator opens the dashboard
- **THEN** the system highlights today's actual effort status and provides a clear action to enter or review today's actual effort

#### Scenario: Dashboard prioritizes today first
- **WHEN** any authenticated user opens the dashboard
- **THEN** the system places today's relevant work or team status ahead of lower-priority monthly summaries

#### Scenario: Member sees monthly workflow status
- **WHEN** a non-administrator opens the dashboard
- **THEN** the system summarizes current-month planned effort, actual effort, allocation issues, and lock state in a way that guides the user to the relevant workflow when attention is needed

#### Scenario: Administrator sees team next actions
- **WHEN** an administrator opens the dashboard
- **THEN** the system highlights team input status, incomplete actual effort, overplanned members, project status, and lock state as operational next actions

### Requirement: Dashboard navigation is contextual
The system SHALL link dashboard items to relevant workflows only when the link is contextual to the displayed status.

#### Scenario: Dashboard card links to related work
- **WHEN** a dashboard card describes a specific actionable state such as today's input, incomplete actuals, overplanned members, or assigned projects
- **THEN** the system may link that card or action to the related workflow

#### Scenario: Dashboard avoids duplicating the full sidebar
- **WHEN** the dashboard is displayed
- **THEN** the system does not repeat all major workflow navigation links that are already available in the application navigation

### Requirement: Dashboard visual hierarchy
The system SHALL make dashboard sections scannable by workflow and urgency.

#### Scenario: User scans the dashboard
- **WHEN** a user opens the dashboard
- **THEN** the system groups cards and summaries into readable sections with clear headings, concise descriptions, and restrained visual emphasis

#### Scenario: Empty or incomplete setup is shown
- **WHEN** dashboard data is missing because setup or assignments are incomplete
- **THEN** the system shows a useful empty state or next action instead of a blank metric-only card

#### Scenario: Dashboard shows workflow orientation
- **WHEN** the dashboard is displayed
- **THEN** the system helps users understand the current month workflow from setup to planning, actual entry, and review without duplicating all sidebar links

## Future Scope (v0.3+)

- Administrator-only financial summaries are outside the v0.2 public dashboard scope.
- Full planned-versus-actual dashboard summaries that combine capacity, plans, and actual allocations are outside the v0.2 public dashboard scope.
