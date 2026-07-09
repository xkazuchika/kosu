## ADDED Requirements

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
