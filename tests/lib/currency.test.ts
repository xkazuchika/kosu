import { describe, expect, test } from "vitest";

import {
  parseOptionalHourlyCostRate,
  parseOptionalYen,
} from "../../app/lib/currency";

describe("yen parsers", () => {
  test("accept empty or a non-negative safe integer", () => {
    expect(parseOptionalYen("")).toBeNull();
    expect(parseOptionalHourlyCostRate("0")).toBe(0);
    expect(parseOptionalHourlyCostRate("2500")).toBe(2500);
  });

  test("reject negative, fractional, non-numeric, and unsafe values", () => {
    expect(parseOptionalHourlyCostRate("-1")).toBeUndefined();
    expect(parseOptionalHourlyCostRate("1.5")).toBeUndefined();
    expect(parseOptionalHourlyCostRate("abc")).toBeUndefined();
    expect(parseOptionalHourlyCostRate("Infinity")).toBeUndefined();
    expect(parseOptionalHourlyCostRate(Number.NaN)).toBeUndefined();
    expect(
      parseOptionalHourlyCostRate(String(Number.MAX_SAFE_INTEGER + 1)),
    ).toBeUndefined();
  });
});
