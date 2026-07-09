## Why

The product now has distinct planning, actual-entry, reporting, and administration workflows, but the interface still feels like a collection of functional screens rather than a guided work tool. Before adding more reporting, kosu needs a clearer navigation model and a calmer, more elegant visual foundation so users understand where to start, what to do next, and how planned effort flows into actual effort.

## What Changes

- Refine the authenticated application shell into a more modern, readable layout with clearer current-page state, stronger workflow grouping, icons where useful, and improved mobile behavior.
- Reorganize navigation around user workflow: dashboard, actual effort, planned effort, analysis, projects, and administration.
- Redesign the dashboard as the primary “what should I do next?” entry point instead of only a metric summary page.
- Introduce product-experience patterns such as Today First guidance, a lightweight workflow map, contextual quick switching, intent-based empty states, and keyboard-friendly planning where they improve clarity.
- Consider a command menu for fast navigation and common actions if it can be implemented accessibly without excessive complexity.
- Establish page-structure rules so screens consistently separate context selection, main input/review work, results/status, and destructive or secondary actions.
- Improve weekday and weekend readability on date-heavy screens while keeping public holidays and company working-day calendars out of this design-refresh scope.
- Refresh shared UI primitives such as cards, buttons, badges, empty states, tables, and form fields to feel simple, restrained, and business-app appropriate.
- Remove remaining visual noise from screens where navigation or secondary actions compete with primary work.
- Keep all existing routes and core behaviors intact; this change is a UX/design refresh, not a functional feature expansion.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ui-ux`: Add requirements for workflow-oriented navigation, current-page awareness, visual system refinement, page composition, reduced in-page navigation duplication, command access, quick switching, workflow mapping, empty states, density, calendar readability, and keyboard-friendly input.
- `dashboard`: Add requirements for Today First dashboard guidance and role-aware workflow entry points.

## Impact

- Affected UI code: `app/components/app-shell.tsx`, shared `app/components/ui/*` primitives, dashboard route, and selected high-traffic input/report screens.
- Affected tests: component tests for navigation/UI primitives and route rendering tests for dashboard and workflow screens.
- Potential new UI-only component code for command menu, quick switcher, workflow map, and empty-state action patterns.
- No database schema, route URL, authentication, authorization, or import/export behavior changes are intended.
