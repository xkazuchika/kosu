## Why

The dashboard identifies daily work logs whose allocation total differs from total working hours, but its links open unfiltered pages. Members must locate the affected dates themselves, which delays correction.

## What Changes

- Add a month filter and an allocation-status filter to the daily work-log list.
- Link the member dashboard's current-month allocation-warning card and alert directly to that member's current-month unbalanced work logs.
- Preserve administrator member selection when filtering work logs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dashboard`: Allocation-warning navigation opens the relevant filtered work-log workflow.
- `time-entries`: Daily work-log review supports selecting a month and showing only unbalanced entries.

## Impact

- `app/routes/work-logs.tsx` loader and list controls
- `app/routes/dashboard.tsx` member allocation-warning links
- Route tests and dashboard tests
