import { test, expect } from "vitest";

import { getWeekdayLabel, isSaturdayDate, isSundayDate, isValidQuarterHour, isWeekendDate, listMonthDates } from "../../app/lib/time";

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

test("listMonthDates returns UTC-safe month dates", () => {
  const dates = listMonthDates("2026-07");

  expect(dates).toHaveLength(31);
  expect(dates[0]).toBe("2026-07-01");
  expect(dates[30]).toBe("2026-07-31");
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
