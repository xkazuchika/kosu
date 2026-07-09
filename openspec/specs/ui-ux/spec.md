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

### Requirement: Horizontal daily allocation plan input
The system SHALL provide a monthly daily allocation planning UI that supports fast project-level planned-hours entry.

#### Scenario: User opens daily allocation planning
- **WHEN** a user opens daily allocation planning for a month
- **THEN** the system shows target month controls, the relevant target member controls, summary totals, and a daily plan input grid

#### Scenario: Grid shows dates and projects
- **WHEN** daily allocation planning data is displayed on desktop
- **THEN** the system presents dates as rows, projects as columns, and planned-hours inputs as cells

#### Scenario: Grid uses relevant project columns
- **WHEN** a user opens daily allocation planning
- **THEN** the system includes columns for projects with monthly plans or existing daily plans and allows adding active assigned projects

#### Scenario: Empty and zero cell copy is clear
- **WHEN** a user edits daily allocation plan cells
- **THEN** the system communicates that empty or zero means no plan and positive values save planned hours

#### Scenario: Mobile daily plan input remains usable
- **WHEN** a user opens daily allocation planning on a mobile-sized viewport
- **THEN** the system keeps date, project, planned-hours input, and save actions usable through horizontal scrolling or compact per-day sections

### Requirement: Planned-to-actual copy feedback
The system SHALL provide clear feedback for planned-to-actual copy results.

#### Scenario: Copy result is shown
- **WHEN** a user runs planned-to-actual copy from daily allocation plans
- **THEN** the system shows how many dates and allocations were copied and how many dates were skipped

#### Scenario: Existing actuals are protected in copy UI
- **WHEN** planned-to-actual copy skips dates because actual allocations already exist
- **THEN** the system explains that existing actual allocations were left unchanged

### Requirement: Planned and actual effort workflow clarity
The system SHALL clearly distinguish planned effort entry from actual effort entry in navigation, page titles, and action buttons.

#### Scenario: User sees actual effort workflow labels
- **WHEN** a user opens work-log entry screens
- **THEN** the system labels them as actual effort entry and uses button labels that describe whether the user is saving total working hours or project-level actual effort

#### Scenario: User sees planned effort workflow labels
- **WHEN** a user opens daily allocation planning screens
- **THEN** the system labels them as planned effort entry and keeps save actions separate from copy-to-actual actions

#### Scenario: User copies saved plans to actuals
- **WHEN** a user sees the copy-to-actual action
- **THEN** the system explains that only saved daily plans are copied and unsaved cell edits must be saved first

#### Scenario: User sees grouped effort navigation
- **WHEN** a user opens the authenticated application shell
- **THEN** the system groups navigation by workflow sections such as input, reports, projects, and administration so planned and actual effort workflows are easier to distinguish

#### Scenario: User sees consistent effort terminology
- **WHEN** a user views navigation, page titles, buttons, tables, and report labels
- **THEN** the system uses total working hours for daily or monthly totals, planned effort for plan hours, and actual effort for project-level actual hours consistently

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

## Future Scope (v0.3+)

- UI patterns for financial reporting and profitability analysis are outside the v0.2 public scope.
