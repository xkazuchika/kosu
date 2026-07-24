## Context

The member dashboard counts current-month daily work logs whose allocation total does not equal the recorded working hours. Its current link opens an unfiltered work-log list, forcing the member to find the problematic dates manually. The existing work-log route already accepts administrator member selection and calculates allocation variance for each list row.

## Goals / Non-Goals

**Goals:**
- Let members reach their current-month unbalanced work logs from the dashboard in one step.
- Let users select a work-log month and optionally limit the list to unbalanced entries.
- Retain administrator access to an explicitly selected member's work logs.

**Non-Goals:**
- Create a new report route or change the administrator dashboard's today-scoped team metric.
- Include work dates with no saved daily work log.
- Change how allocation variance is calculated or how daily work logs are edited.

## Decisions

### Use query parameters on the existing work-log route

`month=YYYY-MM` selects the displayed calendar month and `status=unbalanced` limits rows to nonzero variance. The existing route already owns daily work-log listing and date-level navigation, so extending it keeps the correction flow in one place. A dedicated issue page would duplicate the list and daily-entry links.

### Default the work-log list to the current month

The daily-entry workflow is monthly in practice, and the dashboard warning is explicitly current-month scoped. If `month` is absent or invalid, the route uses the current month. Users can select another month with the list form.

### Preserve only member selection for daily-entry links

Opening a day is the correction action; the selected list filters are not needed on the detail page. Administrator links retain `memberId` so they continue editing the intended member.

## Risks / Trade-offs

- [Users who expected a complete historical list] -> The month picker exposes prior months directly and makes the active time context clear.
- [Malformed URL query] -> Validate `month` and `status` server-side and fall back to the current month or unfiltered status.
- [Administrator dashboard remains today-scoped] -> This change is intentionally limited to the member's current-month warning; team correction workflow can be designed separately.
