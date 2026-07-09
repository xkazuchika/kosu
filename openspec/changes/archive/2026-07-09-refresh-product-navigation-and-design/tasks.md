## 1. Phase 1 Navigation And App Shell

- [x] 1.1 Reorganize authenticated navigation into dashboard, actual effort, planned effort, analysis, projects, and administration workflow groups by role.
- [x] 1.2 Add `lucide-react` and use imported icons consistently for navigation and high-value status/action cues.
- [x] 1.3 Add current-page and current-section visual state to the application navigation without relying on color alone.
- [x] 1.4 Add a mobile navigation pattern that keeps primary workflow groups reachable when the desktop sidebar is hidden.
- [x] 1.5 Keep navigation definitions structured so Phase 2 command menu can reuse role-aware destinations.
- [x] 1.6 Update AppShell component tests for role-aware groups, current state, icon/accessibility labels, and mobile navigation affordance.

## 2. Phase 1 Visual System Primitives

- [x] 2.1 Refresh Button variants so primary, secondary, outline, ghost, and destructive actions have consistent hierarchy, optional icon support, and focus states.
- [x] 2.2 Refresh Card, Badge, EmptyState, Field/Input, and DataTable primitives for calmer spacing, borders, typography, and semantic status treatment.
- [x] 2.3 Add shared patterns for intent-based empty states, compact status cards, and optional icon-leading labels.
- [x] 2.4 Add or update UI primitive tests for class/role behavior that matters to accessibility and consistency.

## 3. Phase 1 Dashboard Flow

- [x] 3.1 Redesign the member dashboard into sections for today's work, monthly status, next checks, and assigned projects using existing loader data.
- [x] 3.2 Redesign the administrator dashboard into sections for team input status, operational issues, project summary, and setup/management cues using existing loader data.
- [x] 3.3 Add a lightweight workflow map showing setup, planned effort, actual effort, and review orientation.
- [x] 3.4 Ensure dashboard links are contextual to the displayed status and do not duplicate the full sidebar.
- [x] 3.5 Update dashboard route tests to cover Today First guidance, workflow orientation, role-aware next actions, and key empty states.

## 4. Phase 1 Page Composition Cleanup

- [x] 4.1 Apply the page header/context/status/main-work pattern to daily actual entry screens.
- [x] 4.2 Apply the page header/context/status/main-work pattern to monthly total working-hours entry.
- [x] 4.3 Apply the page header/context/status/main-work pattern to daily planned effort entry.
- [x] 4.4 Apply the page header/context/status/main-work pattern to monthly planned effort screens.
- [x] 4.5 Apply the page header/context/status/main-work pattern to planned-vs-actual and effort report screens where needed.
- [x] 4.6 Preserve existing context controls while shaping them so Phase 2 quick switchers can replace or wrap them later.
- [x] 4.7 Add weekday labels and subtle weekend styling to date-heavy monthly and daily planning screens without changing validation behavior.
- [x] 4.8 Add weekday context to date-specific daily actual entry headers where useful.
- [x] 4.9 Improve empty states on setup-dependent and work-data-empty screens.
- [x] 4.10 Verify generic sibling navigation button rows are not reintroduced on work screens.

## 5. Phase 1 Mobile And Accessibility Review

- [x] 5.1 Verify primary workflows are reachable and usable at mobile widths.
- [x] 5.2 Verify keyboard flow through repeated daily actual, monthly total, and daily planned effort inputs.
- [x] 5.3 Verify keyboard focus states, landmarks, labels, and status messages remain accessible after visual updates.
- [x] 5.4 Verify weekday/weekend styling remains readable and is not presented as holiday or working-calendar logic.
- [x] 5.5 Smoke test desktop and mobile layouts for dashboard, daily actual entry, monthly total entry, daily planning, monthly planning, and planned-vs-actual.

## Phase 2 Backlog

- Implement Command Menu with `Cmd/Ctrl+K`, role-aware destinations, Japanese labels, optional English aliases, and no destructive operations.
- Roll out compact month/member Quick Switcher across monthly planning, actual entry, and reports where it improves context switching.
- Refine Workflow Map after Phase 1 dashboard is visible and user-tested.
- Add advanced keyboard planning enhancements beyond natural tab order only where they can be tested and remain accessible.
- Expand intent-based empty states across lower-traffic administration and report screens.

## 6. Verification

- [x] 6.1 Run OpenSpec validation for `refresh-product-navigation-and-design`.
- [x] 6.2 Run targeted component and route tests for navigation, UI primitives, dashboard, and updated workflow screens.
- [x] 6.3 Run full typecheck, lint, test, and build.
