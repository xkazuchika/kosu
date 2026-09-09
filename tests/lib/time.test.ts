import { test, expect } from "vitest";

import {
  addCalendarDays,
  getCalendarDate,
  getCalendarMonth,
  getWeekdayLabel,
  isSaturdayDate,
  isSundayDate,
  isValidCalendarDate,
  isValidDailyHours,
  isValidMonth,
  isValidQuarterHour,
  isValidTimeZone,
  isWeekendDate,
  listMonthDates,
  listWeekDates,
  normalizeTimeZone,
} from "../../app/lib/time";

test("isValidQuarterHour accepts 0.25 increments", () => {
  expect(isValidQuarterHour(0.25)).toBe(true);
  expect(isValidQuarterHour(0.5)).toBe(true);
  expect(isValidQuarterHour(1.25)).toBe(true);
  expect(isValidQuarterHour(8)).toBe(true);
});

test("isValidQuarterHour rejects invalid increments", () => {
  expect(isValidQuarterHour(0)).toBe(false);
  expect(isValidQuarterHour(0.1)).toBe(false);
  expect(isValidQuarterHour(0.33)).toBe(false);
  expect(isValidQuarterHour(1.23)).toBe(false);
  expect(isValidQuarterHour(-1)).toBe(false);
});

test("daily hours are bounded to 24 hours", () => {
  expect(isValidDailyHours(0.25)).toBe(true);
  expect(isValidDailyHours(24)).toBe(true);
  expect(isValidDailyHours(24.25)).toBe(false);
  expect(isValidDailyHours(0)).toBe(false);
});

test("calendar date validation rejects normalized and impossible dates", () => {
  expect(isValidCalendarDate("2026-02-28")).toBe(true);
  expect(isValidCalendarDate("2028-02-29")).toBe(true);
  expect(isValidCalendarDate("2026-02-29")).toBe(false);
  expect(isValidCalendarDate("2026-04-31")).toBe(false);
  expect(isValidCalendarDate("2026-2-03")).toBe(false);
  expect(isValidCalendarDate("0000-01-01")).toBe(false);
  expect(listWeekDates("2026-02-29")).toEqual([]);
});

test("listMonthDates returns UTC-safe month dates", () => {
  const dates = listMonthDates("2026-07");

  expect(dates).toHaveLength(31);
  expect(dates[0]).toBe("2026-07-01");
  expect(dates[30]).toBe("2026-07-31");
});

test("month and timezone validation rejects invalid calendar configuration", () => {
  expect(isValidMonth("2026-07")).toBe(true);
  expect(isValidMonth("2026-13")).toBe(false);
  expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
  expect(isValidTimeZone("Not/A_Timezone")).toBe(false);
  expect(normalizeTimeZone(" UTC ")).toBe("UTC");
});

test("workspace calendar follows timezone day and month boundaries", () => {
  const referenceTime = new Date("2026-07-31T15:30:00.000Z");

  expect(getCalendarDate(referenceTime, "UTC")).toBe("2026-07-31");
  expect(getCalendarMonth(referenceTime, "UTC")).toBe("2026-07");
  expect(getCalendarDate(referenceTime, "Asia/Tokyo")).toBe("2026-08-01");
  expect(getCalendarMonth(referenceTime, "Asia/Tokyo")).toBe("2026-08");
});

test("weekday helpers label weekends", () => {
  expect(getWeekdayLabel("2026-07-04")).toBe("土");
  expect(getWeekdayLabel("2026-07-05")).toBe("日");
  expect(isWeekendDate("2026-07-04")).toBe(true);
  expect(isSaturdayDate("2026-07-04")).toBe(true);
  expect(isSundayDate("2026-07-05")).toBe(true);
  expect(isSundayDate("2026-07-04")).toBe(false);
  expect(isWeekendDate("2026-07-06")).toBe(false);
});

test("week helpers return Monday through Sunday across month boundaries", () => {
  expect(listWeekDates("2026-07-01")).toEqual([
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
  ]);
  expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
});
