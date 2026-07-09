## Context

kosu has grown from basic daily actual effort entry into monthly planning, daily planning, planned-to-actual copy, and planned-vs-actual review. The current UI is functional, but the product workflow is still mostly expressed through screen names. Users need a clearer sense of where they are, what kind of work they are doing, and what the next useful action is.

Current constraints:

- Existing URLs and route behavior should remain stable.
- The app is Japanese-first, but icons and short English labels are acceptable when they improve scannability and remain clear.
- Navigation should carry cross-screen movement; individual screens should focus on the current task.
- The design refresh should not add new domain features such as daily planned-vs-actual reporting, financial reports, approvals, attendance, or payroll.
- The implementation should stay lightweight and avoid introducing a large UI framework or icon dependency unless there is a concrete need.

## Goals / Non-Goals

**Goals:**

- Make the app feel simple, modern, and elegant without hiding business information.
- Clarify product workflow: prepare projects, plan effort, enter actual effort, analyze results, administer data.
- Make the sidebar a reliable application map with current-page awareness.
- Make the dashboard a role-aware entry point for “what should I do next?” rather than only a set of metrics.
- Add high-leverage product-experience patterns that make the app feel fast and guided: command access, quick switching, workflow mapping, intent-based empty states, and keyboard-friendly planning.
- Standardize page composition so repeated screens feel predictable.
- Refresh shared UI primitives so cards, buttons, badges, forms, tables, empty states, and messages have consistent visual weight.
- Preserve mobile usability for core entry and planning workflows.

**Non-Goals:**

- No route renames or URL migrations.
- No new reporting capability in this change.
- No database schema changes.
- No public-holiday source, company holiday management, or configurable working-day calendar in this change.
- No design-token package or external component system adoption unless later proven necessary.
- No full brand identity work, logo redesign, marketing site, or public screenshot production in this change.

## Product Experience Principles

- **Today first:** login should immediately answer what needs attention today.
- **Workflow over pages:** the product should communicate `Setup -> Plan -> Actual -> Review`, not just route names.
- **Fast to move:** frequent destinations and common actions should be reachable through navigation, dashboard actions, and optionally command search.
- **Fast to enter:** planning and actual-entry screens should minimize pointer travel and support keyboard-friendly data entry.
- **Empty means next step:** empty states should explain the missing setup or data and point to the next useful action.
- **Numbers stay readable:** planned hours, actual hours, differences, and statuses should remain easy to compare.
- **Dates stay readable:** date-heavy screens should make weekday and weekend context visible without pretending to know holidays or company working days.
- **Calm by default:** visual emphasis should be reserved for current location, primary action, warnings, and meaningful status.

## Decisions

### Decision 0: Phased Implementation

Implement the experience refresh in phases so the first pass improves the core product without becoming too large.

Phase 1:

- Sidebar/navigation reorganization.
- Icons and current-location treatment.
- Mobile navigation reachability.
- Shared UI primitive refresh.
- Dashboard Today First redesign.
- Weekday and weekend readability improvements.
- Low-risk page composition cleanup on high-traffic screens.

Phase 2:

- Command Menu.
- Quick Switcher rollout beyond simple context controls.
- Workflow Map refinements after the dashboard redesign is visible.
- Keyboard-friendly planning enhancements beyond natural tab order.
- Broader intent-based empty-state pass across lower-traffic admin and report screens.

Rationale:

- Phase 1 delivers visible design and workflow improvement quickly.
- Phase 2 contains higher-interaction patterns that benefit from seeing the refreshed foundation first.

### Decision 1: Workflow-Oriented Navigation

Use the sidebar as the app map and group routes by workflow rather than implementation category.

Target structure:

- Home: ダッシュボード
- 実績工数: 日別工数実績入力, 月別総稼働時間入力
- 予定工数: 日別予定工数入力, 月次予定工数, 月次予定工数入力 for administrators
- 分析: 予定工数対実績工数, 工数実績レポート
- 案件: 担当案件 or 案件管理, 自己アサイン
- 管理: メンバー, インポート, 設定 for administrators

Rationale:

- Users think in terms of actual entry, planning, analysis, and administration.
- A deeper tree would add expand/collapse state and complexity before the app needs it.
- A sectioned sidebar preserves simplicity while still improving orientation.

Alternatives considered:

- Keep current `入力` / `レポート` / `案件` grouping: simple, but planning and actual entry remain mixed.
- Add a collapsible tree: more scalable, but heavier and less elegant for the current route count.

### Decision 2: Dashboard as Next-Action Hub

Redesign the dashboard around operational next actions and status clarity.

Member dashboard sections:

- 今日の作業: today’s actual effort status and primary action.
- 今月の状態: planned effort, actual effort, allocation issues, lock state.
- 次に確認すること: incomplete actual entries, daily plans, planned-vs-actual review when relevant.
- 担当案件: assigned project context.

Administrator dashboard sections:

- 今日のチーム状況: input count, incomplete allocation count.
- 今月の運用状況: overplanned members, active projects, lock state.
- 確認が必要なもの: incomplete actuals, overplanned members, missing setup.
- 案件サマリー: project planned vs actual totals.

Rationale:

- Dashboard cards should guide users into the correct workflow, not duplicate all sidebar navigation.
- The dashboard can contain contextual next-step links because they respond to current status.

Alternatives considered:

- Dashboard as pure KPI grid: visually compact, but weak as a product entry point.
- Dashboard as activity feed: potentially useful later, but no event model exists yet.

### Decision 2a: Workflow Map

Introduce a lightweight workflow map to make the product model visible.

Target flow:

- Setup: members, projects, assignments.
- Plan: monthly planned effort and daily planned effort.
- Actual: total working hours and project-level actual effort.
- Review: planned-vs-actual and effort reports.

Use this as a dashboard section or contextual header treatment where it helps orientation. Keep it subtle: chips, small steps, or compact cards rather than a large process diagram.

Rationale:

- Users need to understand where daily planning and actual entry fit in the monthly workflow.
- The workflow map should guide behavior without turning kosu into a heavy ERP process tool.

### Decision 2b: Command Menu

Consider adding a command menu as a fast-access layer for navigation and common actions.

Initial command scope:

- Navigate to dashboard, actual effort entry, planned effort entry, reports, projects, and administration screens.
- Open today's actual effort entry.
- Open current-month planning and reports.
- Start common administrator setup flows such as member, project, import, or settings pages where routes already exist.

Constraints:

- The command menu must be keyboard accessible.
- It should not be the only way to reach any route.
- It should not execute destructive actions.
- If implementation feels too large, defer it behind the rest of the visual/navigation refresh.

Rationale:

- `Cmd/Ctrl+K` is now a familiar pattern in modern productivity tools.
- It improves perceived speed without adding more visible navigation chrome.

### Decision 2c: Quick Switcher

Use a common quick switcher pattern for target month and, for administrators, target member.

Behavior:

- Keep existing query parameter semantics.
- Present target context compactly near the top of pages.
- Use clear labels and accessible form controls, even if visually styled as a switcher.
- Do not hide complex filters behind the switcher on report pages where explicit filter forms are clearer.

Rationale:

- Month/member context appears across planning, actual entry, and reports.
- A consistent switcher reduces form clutter and makes screens feel more integrated.

### Decision 3: Screen-Level Navigation Rule

Use this rule consistently:

- Cross-screen app navigation belongs in the sidebar.
- Contextual movement inside a workflow can stay in the page, such as previous/today/next date controls.
- Primary work actions stay inside the relevant card, such as save, add, delete, copy to actuals, filter, and apply.
- Contextual recommendations can appear on the dashboard or in empty states.
- Do not place generic sibling-page link button rows at the top of work screens.

Rationale:

- This keeps pages focused and avoids the confusion caused by unrelated buttons competing with the page title and primary action.

### Decision 4: Page Composition Pattern

Use predictable page structure across high-traffic screens:

1. Page header: title, one-line explanation, status badge when relevant.
2. Context controls: target month/member/date filters.
3. Status/result messages: success, warning, validation errors.
4. Main work area: input grid, form, or table.
5. Secondary or destructive actions: separated from primary work when needed.

Rationale:

- Users should not have to relearn screen structure for each route.
- This pattern matches current routes without requiring architecture changes.

### Decision 4a: Intent-Based Empty States

Empty states should describe what is missing, why it matters, and the next useful action.

Examples:

- No assigned projects: explain that actual and planned effort need assigned projects, then point to self-assignment or project administration depending on role.
- No daily planned effort: explain that daily plans can be entered from assigned or monthly-plan projects.
- No actual effort: point to today's actual effort entry or monthly total working-hours entry.

Rationale:

- Empty screens are common during setup and evaluation.
- Good empty states reduce onboarding burden without adding a separate onboarding flow.

### Decision 4b: Weekday And Working-Day Boundary

Improve weekday and weekend readability where the app displays date-heavy workflows.

In scope for this design refresh:

- Keep weekday labels on monthly total working-hours entry and daily planned effort entry.
- Add weekday labels to date-specific daily actual entry headers where useful.
- Add subtle weekend treatment in monthly rows and daily planning grids, such as muted backgrounds or semantic text color.
- Add tests for date helpers and route loader data where weekday behavior matters.

Out of scope for this design refresh:

- Japanese public holiday calculation or external holiday source integration.
- Company holidays, substitute holidays, working-day overrides, or per-workspace calendars.
- Using holidays or working days to validate, block, or auto-fill planned or actual effort.
- Capacity calculations based on working-day calendars.

Future working-calendar direction:

- A later `working-calendar` capability should define whether kosu uses Japan public holidays, workspace-specific holidays, per-member schedules, or simple manual non-working-day markings.
- That future change should decide whether holidays are visual-only, affect planning suggestions, affect capacity, or affect validation.

Rationale:

- Weekday and weekend cues improve readability immediately without changing domain rules.
- Holiday and working-day behavior is product logic, not just UI styling, and should be designed separately to avoid incorrect assumptions.

### Decision 5: Restrained Visual System

Refresh the visual language around calm business clarity. The reference direction is `Linear lightness + Stripe Dashboard data readability + shadcn/ui component quality`, adapted for kosu's Japanese-first effort-management domain.

- Background: warm or neutral off-white / slate rather than flat gray-heavy UI.
- Cards: white surface, subtle border, minimal shadow, consistent radius.
- Typography: slightly larger page titles, calmer body copy, tighter hierarchy.
- Accent: use a more restrained indigo/blue primary accent instead of the current brighter sky-heavy treatment.
- Buttons: only primary task actions get high color emphasis; secondary actions use outline/ghost styles.
- Tables: clearer header contrast, more readable row spacing, right-aligned numeric data where feasible.
- Badges: semantic tones but softer and less saturated.
- Icons: use small, consistent icons where they make workflow groups, status, or actions easier to scan; do not rely on icon-only meaning without accessible labels.
- Short English: allow concise English UI words such as Home, Plan, Actual, Analyze, Admin, Today, or Export when they are clearer or more compact than long Japanese labels.

Reference mapping:

- Linear: borrow the light sidebar feel, generous spacing, quiet current-location treatment, and fast scanning.
- Stripe Dashboard: borrow the readable business-data tables, numeric hierarchy, clear filters, and reliable dashboard density.
- shadcn/ui: borrow the simple component proportions, restrained borders, accessible focus states, and form clarity.

Avoid:

- Do not make the app as abstract or developer-tool-like as Linear.
- Do not make the app as financial-platform-heavy as Stripe.
- Do not copy shadcn example layouts directly or create a generic template feel.

Rationale:

- kosu should feel trustworthy and lightweight, not like a generic marketing SaaS template.
- Shared primitives give the broadest UI improvement with the least route-by-route churn.
- The reference blend gives implementation guidance without tying the product to one external visual identity.

### Decision 5b: Density And Rhythm Rules

Use controlled density rather than one-size-fits-all spacing.

Rules:

- Dashboards use medium density with clear section spacing.
- Entry forms use comfortable density around controls and tighter grouping inside repeated rows.
- Tables and grids use compact but readable density, with numeric columns aligned consistently.
- Avoid mixing very large cards and cramped tables on the same screen unless the hierarchy is intentional.
- Prefer one strong primary action per section.

Rationale:

- kosu needs to feel light while still handling business data.
- Density rules prevent both bloated SaaS cards and cramped admin-table sprawl.

### Decision 5c: Keyboard-Friendly Planning

Improve planning and actual-entry screens so keyboard users can move quickly through repeated fields.

Targets:

- Preserve natural tab order through date/project/hour fields.
- Keep save actions reachable after repeated inputs.
- Avoid custom keyboard behavior unless it is reliable and tested.
- Consider spreadsheet-like enhancements for daily planned effort only after the core layout is stable.

Rationale:

- Daily planned effort can involve many cells.
- Keyboard friendliness improves speed without adding visual complexity.

### Decision 5a: Icon And Label Policy

Use icons and short English labels as supportive UI language, not decoration.

Guidelines:

- Icons may be used for sidebar groups, status cards, primary dashboard actions, date movement, filters, and destructive actions.
- Icon-only controls must have accessible names through visible text or `aria-label`.
- Navigation items should remain understandable if icons fail to load or are not visually recognized.
- Japanese labels remain preferred for domain-specific concepts such as `予定工数`, `実績工数`, and `総稼働時間`.
- Short English labels are acceptable for universal or compact UI concepts, especially in navigation section labels and dashboard microcopy.
- Use `lucide-react` for icons unless implementation reveals a concrete issue; import only the icons used.

Label rules:

- Sidebar section labels may use compact English: `Home`, `Actual`, `Plan`, `Analyze`, `Projects`, `Admin`.
- Screen titles stay Japanese, such as `日別予定工数入力`.
- Domain concepts stay Japanese: `予定工数`, `実績工数`, `総稼働時間`, `稼働可能時間`.
- Buttons prefer Japanese labels, especially for save, copy, delete, and domain actions.
- Command Menu, when implemented, should support Japanese labels and may include English aliases for searchability.

Rationale:

- Icons can reduce scanning cost and make the interface feel more current.
- Domain terminology still needs Japanese clarity because kosu’s core concepts are business-specific.
- `lucide-react` matches the Linear/shadcn-inspired direction and avoids maintaining many inline SVGs manually.

### Decision 6: Mobile Treatment

Keep desktop sidebar behavior but improve mobile orientation.

Minimum implementation target:

- Header must show product identity and user controls cleanly on small screens.
- Mobile users must be able to reach the main workflow groups without relying on the hidden desktop sidebar.
- Large grids and tables may retain horizontal scrolling when the data model requires it, but core controls and primary actions must remain reachable.

Rationale:

- The current desktop sidebar is hidden on mobile, leaving route access weak unless users know URLs.
- A full drawer can be considered, but a simple mobile navigation surface may be enough for this phase.

### Decision 7: Command Menu Timing

Do not implement the Command Menu in Phase 1 unless the navigation and dashboard work lands faster than expected.

Phase 1 should leave the codebase ready for command access by keeping navigation definitions structured and reusable. Phase 2 can then add `Cmd/Ctrl+K` with role-aware destinations and non-destructive actions.

Rationale:

- Command Menu is valuable, but it is a higher-interaction feature with accessibility and keyboard behavior requirements.
- The app should first get the visible information architecture and visual foundation right.

## Risks / Trade-offs

- Navigation churn may briefly disorient existing users. Mitigation: keep route URLs stable and labels close to current terminology.
- A dashboard redesign can become feature creep. Mitigation: use existing loader data and avoid adding new domain calculations unless already available.
- Visual refresh can create inconsistent route styling if only partially applied. Mitigation: start with shared primitives and high-traffic screens, then update tests for structure and labels.
- Mobile navigation can become complex. Mitigation: implement the simplest accessible pattern first and verify core route reachability.
- Some table screens need route-specific refinement beyond shared primitives. Mitigation: standardize common patterns first and leave deeper report/table redesigns to later changes if needed.
- Icons can become decorative clutter or hurt accessibility. Mitigation: use them only where they improve scanning and require accessible labels for icon-only controls.
- Command menu scope can grow too large. Mitigation: start with navigation and non-destructive common actions only.
- Adding `lucide-react` increases dependency surface. Mitigation: use it only for icons, import individual icons, and verify bundle/build output.
- Quick switchers can hide important filters. Mitigation: use them for common context only and keep explicit filters on reports.
- Workflow maps can feel process-heavy. Mitigation: keep them compact and orienting, not mandatory or blocking.
- Weekend styling may be mistaken for true non-working-day logic. Mitigation: label it as weekday/weekend context only and avoid holiday/working-day validation in this change.

## Migration Plan

1. Implement Phase 1 navigation, icon, current-page, mobile reachability, visual primitive, dashboard, and weekday/weekend improvements.
2. Keep command menu, full quick switcher rollout, deeper workflow map refinement, and advanced keyboard planning enhancements scoped to Phase 2.
3. Preserve existing URLs and route behavior throughout both phases.
4. Add or update component and route tests for the implemented phase.
5. Run typecheck, lint, tests, build, and a browser smoke check on desktop and mobile widths.

Rollback strategy:

- Since there are no schema or URL changes, rollback is a normal code revert.

## Open Questions

- Should the mobile navigation be a collapsible top navigation, a drawer, or a compact workflow selector?
- Should dashboard next-action cards include priority ordering, or simply group by workflow?
- Should public holidays and company working days be proposed next as a separate `working-calendar` capability?
