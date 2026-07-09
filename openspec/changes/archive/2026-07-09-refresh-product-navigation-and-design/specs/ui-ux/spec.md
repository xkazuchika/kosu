## ADDED Requirements

### Requirement: Workflow-oriented navigation
The system SHALL organize authenticated navigation around user workflows so users can distinguish actual effort, planned effort, analysis, project work, and administration.

#### Scenario: Member sees workflow navigation groups
- **WHEN** a non-administrator opens the authenticated application shell
- **THEN** the system displays navigation groups for dashboard, actual effort, planned effort, analysis, and project workflows without administrator-only links

#### Scenario: Administrator sees workflow navigation groups
- **WHEN** an administrator opens the authenticated application shell
- **THEN** the system displays navigation groups for dashboard, actual effort, planned effort, analysis, projects, and administration

#### Scenario: Current page is visible in navigation
- **WHEN** a user opens a page that appears in the authenticated navigation
- **THEN** the system visually identifies the current navigation item without relying on color alone

#### Scenario: Sidebar remains the cross-screen map
- **WHEN** a user needs to move between major workflows
- **THEN** the system provides that movement through the application navigation rather than repeated sibling-page button rows inside individual screens

### Requirement: Workflow map
The system SHALL expose a lightweight workflow map that helps users understand the flow from setup to planning, actual entry, and review.

#### Scenario: User sees product workflow
- **WHEN** a user opens a workflow-oriented entry point such as the dashboard
- **THEN** the system presents the flow from setup to planned effort, actual effort, and review in a compact non-blocking way

#### Scenario: Workflow map stays lightweight
- **WHEN** the workflow map is displayed
- **THEN** the system uses it for orientation without adding required approval steps, blockers, or ERP-style process controls

### Requirement: Command access
The system SHALL support fast access to common destinations and non-destructive actions when a command menu is implemented in a later phase of this refresh.

#### Scenario: User opens command menu
- **WHEN** a user invokes the command menu with keyboard or visible control
- **THEN** the system lets the user search or select common destinations such as dashboard, actual entry, planning, reports, projects, and administration screens allowed by role

#### Scenario: Command menu respects access
- **WHEN** a non-administrator uses command access
- **THEN** the system does not show administrator-only destinations or actions

#### Scenario: Command menu avoids destructive actions
- **WHEN** command access is available
- **THEN** the system does not execute destructive operations such as delete, archive, lock, or unlock directly from the command menu

### Requirement: Context quick switcher
The system SHALL provide a consistent compact way to switch common page context such as month and selected member where that context is central to the workflow.

#### Scenario: User switches month context
- **WHEN** a user opens a monthly planning, actual entry, or report screen with month context
- **THEN** the system provides a clear month switcher that preserves the page workflow and existing query parameter behavior

#### Scenario: Administrator switches member context
- **WHEN** an administrator opens a workflow that supports selected-member context
- **THEN** the system provides a clear member switcher without exposing that control to non-administrators

#### Scenario: Report filters stay explicit when needed
- **WHEN** a report has multiple filters beyond month or member
- **THEN** the system keeps those filters visible enough to understand the report query rather than hiding them all inside a quick switcher

### Requirement: Calendar date readability
The system SHALL make date-heavy workflows easier to scan by showing weekday and weekend context without introducing holiday or working-day business rules.

#### Scenario: Monthly rows show weekday context
- **WHEN** a user opens a monthly total working-hours or daily planned effort grid
- **THEN** the system shows weekday context for each date and visually distinguishes weekends in a subtle, readable way

#### Scenario: Date-specific pages show weekday context
- **WHEN** a user opens a date-specific actual entry page
- **THEN** the system shows the weekday alongside the selected date where it helps orientation

#### Scenario: Holidays are not inferred
- **WHEN** a date is a public holiday, company holiday, or special working day but no working calendar capability has been configured
- **THEN** the system does not mark that date as an authoritative holiday, non-working day, or working day

#### Scenario: Weekend styling does not block entry
- **WHEN** a date is visually shown as Saturday or Sunday
- **THEN** the system still allows planned effort and actual effort entry according to the existing validation and lock rules

### Requirement: Focused page action model
The system SHALL keep page-level actions focused on the current workflow while moving generic cross-screen navigation into the application shell.

#### Scenario: Work screen avoids generic sibling links
- **WHEN** a user opens an input or report screen
- **THEN** the system does not show a generic row of sibling workflow navigation buttons that duplicates the application navigation

#### Scenario: Contextual workflow movement remains local
- **WHEN** a user opens a date-specific or record-specific workflow screen
- **THEN** the system may show contextual controls such as previous date, today, next date, edit, save, delete, or copy actions that operate within the current workflow

#### Scenario: Primary action is visually distinct
- **WHEN** a page presents multiple actions
- **THEN** the system visually distinguishes the primary work action from secondary, destructive, and navigation actions

### Requirement: Consistent page composition
The system SHALL apply a predictable composition pattern to high-traffic pages.

#### Scenario: Page header explains the current work
- **WHEN** a user opens a high-traffic input, planning, or report page
- **THEN** the system shows a page title, concise description, and relevant status badge before detailed controls

#### Scenario: Context controls precede work area
- **WHEN** a page has target member, target date, target month, or filter controls
- **THEN** the system presents those controls before the main input or review area

#### Scenario: Status messages do not interrupt primary work
- **WHEN** a page shows validation, save, copy, warning, or success messages
- **THEN** the system places those messages near the related workflow context without visually competing with the main action area

### Requirement: Intent-based empty states
The system SHALL use empty states to explain missing data and guide the next useful action.

#### Scenario: Setup-dependent data is missing
- **WHEN** a page cannot show useful content because setup data such as projects, assignments, members, or plans is missing
- **THEN** the system explains what is missing, why it matters, and the relevant next action for the user's role

#### Scenario: Work data is not entered yet
- **WHEN** a planning, actual entry, or report page has no matching work data
- **THEN** the system provides a concise empty state that points to the appropriate entry or setup workflow without implying an error

### Requirement: Refined visual system
The system SHALL use a restrained, modern visual system that remains clear for business data entry and review.

#### Scenario: Visual references are adapted to kosu
- **WHEN** the UI is refreshed
- **THEN** the system adapts Linear-like light navigation, Stripe-like data readability, and shadcn-like component quality without copying any single product's visual identity

#### Scenario: Shared primitives use consistent visual weight
- **WHEN** cards, buttons, badges, form fields, tables, and empty states are rendered
- **THEN** the system uses consistent spacing, border weight, radius, focus states, and typography hierarchy

#### Scenario: Data-heavy pages remain readable
- **WHEN** a user views a table or grid with effort values
- **THEN** the system keeps headers, rows, numeric values, and empty states readable on desktop and mobile

#### Scenario: Interface avoids excessive emphasis
- **WHEN** a page contains multiple cards, metrics, or actions
- **THEN** the system uses restrained color and shadow so only meaningful status and primary actions stand out

#### Scenario: Density matches the work
- **WHEN** dashboards, forms, tables, and planning grids are rendered
- **THEN** the system uses spacing and density appropriate to the task so summary cards feel readable and repeated data-entry areas remain efficient

#### Scenario: Icons support scanning
- **WHEN** icons are used in navigation, dashboard cards, status indicators, or actions
- **THEN** the system uses them consistently as supportive cues while keeping the UI understandable through text or accessible labels

#### Scenario: Icons use a consistent source
- **WHEN** the implementation adds icons
- **THEN** the system uses a consistent lightweight icon source and imports only the icons required by the UI

#### Scenario: Short English labels are acceptable
- **WHEN** a compact English label is clearer or more elegant than a long Japanese label for a universal UI concept
- **THEN** the system may use that English label while preserving Japanese terminology for domain concepts such as planned effort, actual effort, and total working hours

#### Scenario: Domain actions remain Japanese
- **WHEN** the user sees page titles, buttons, and domain-specific effort labels
- **THEN** the system keeps Japanese wording for business concepts and important actions even if navigation section labels use compact English

### Requirement: Mobile workflow reachability
The system SHALL keep primary workflow navigation reachable on mobile-sized screens.

#### Scenario: User opens app on mobile
- **WHEN** a user opens the authenticated application shell on a mobile-sized viewport
- **THEN** the system provides a usable way to reach primary workflow groups without relying on the hidden desktop sidebar

#### Scenario: Core actions remain reachable on mobile
- **WHEN** a user opens daily actual entry, monthly total entry, daily planning, monthly planning, or reporting screens on mobile
- **THEN** the system keeps context controls and primary actions reachable without layout overlap or hidden controls

### Requirement: Keyboard-friendly repeated input
The system SHALL keep repeated planning and actual-entry workflows efficient for keyboard users.

#### Scenario: User tabs through repeated inputs
- **WHEN** a user enters repeated daily actual, monthly total, or daily planned effort values with the keyboard
- **THEN** the system preserves a predictable tab order through fields and keeps save actions reachable

#### Scenario: Spreadsheet-like enhancements remain reliable
- **WHEN** spreadsheet-like keyboard behavior is added to a planning grid
- **THEN** the system keeps the behavior accessible, tested, and non-destructive, with ordinary form submission still available
