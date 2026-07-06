import { test, expect } from "vitest";

import { isValidQuarterHour } from "../../app/lib/time";

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
