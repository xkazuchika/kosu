// @vitest-environment node

import { describe, expect, test } from "vitest";

import { neutralizeCsvCell, parseCsv, stringifyCsv } from "../../app/lib/csv";

describe("parseCsv", () => {
  test("parses plain csv", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("strips a leading byte order mark", () => {
    expect(parseCsv("\uFEFFemail,displayName\nadmin@example.com,Admin")).toEqual([
      ["email", "displayName"],
      ["admin@example.com", "Admin"],
    ]);
  });

  test("keeps quoted commas and escaped quotes", () => {
    expect(parseCsv('"a,b","say ""hi"""')).toEqual([["a,b", 'say "hi"']]);
  });
});

describe("neutralizeCsvCell", () => {
  test("prefixes formula-like text values", () => {
    expect(neutralizeCsvCell("=HYPERLINK(\"http://evil\")")).toBe("'=HYPERLINK(\"http://evil\")");
    expect(neutralizeCsvCell("+cmd")).toBe("'+cmd");
    expect(neutralizeCsvCell("-cmd")).toBe("'-cmd");
    expect(neutralizeCsvCell("@evil")).toBe("'@evil");
  });

  test("keeps numeric values untouched", () => {
    expect(neutralizeCsvCell("-5")).toBe("-5");
    expect(neutralizeCsvCell("-5.25")).toBe("-5.25");
    expect(neutralizeCsvCell("8")).toBe("8");
  });

  test("keeps ordinary text untouched", () => {
    expect(neutralizeCsvCell("Website")).toBe("Website");
    expect(neutralizeCsvCell("")).toBe("");
  });
});

describe("stringifyCsv", () => {
  test("neutralizes formula-like cells and quotes as needed", () => {
    const csv = stringifyCsv([["name", "note"], ["Website", "=cmd()"], ["=-x,y", "plain"]]);
    expect(csv).toBe("name,note\nWebsite,'=cmd()\n\"'=-x,y\",plain");
  });
});
