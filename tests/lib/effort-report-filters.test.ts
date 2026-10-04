import { describe, expect, test } from "vitest";
import {
  effortReportSearch,
  parseEffortReportFilters,
} from "../../app/lib/effort-report-filters";
import { projectTypeLabels } from "../../app/lib/master-labels";

describe("effort report conditions", () => {
  test("every filter combination preserves applied conditions and fixes members to self", () => {
    const entries = Object.entries({
      month: "2026-07",
      memberId: "other",
      departmentName: "開発 & 営業",
      role: "member",
      projectId: "p",
      projectType: "internal",
    });
    for (let mask = 0; mask < 2 ** entries.length; mask++) {
      const selected = entries.filter((_, index) => mask & (1 << index));
      const url = new URL(
        `http://localhost/reports?${new URLSearchParams(selected)}`,
      );
      for (const role of ["admin", "member"]) {
        const member = { id: "self", role };
        const filters = parseEffortReportFilters(url, member, "2026-09");
        expect(filters).toEqual({
          month: "2026-09",
          ...Object.fromEntries(selected),
          ...(role === "member" ? { memberId: "self" } : {}),
        });
        expect(
          parseEffortReportFilters(
            new URL(`http://localhost/reports?${effortReportSearch(filters)}`),
            member,
            "2026-09",
          ),
        ).toEqual(filters);
      }
    }
  });
  test("all applied conditions survive serialization", () => {
    const url = new URL(
      "http://localhost/reports?month=2026-07&memberId=m&departmentName=開発&role=member&projectId=p&projectType=internal",
    );
    const filters = parseEffortReportFilters(
      url,
      { id: "admin", role: "admin" },
      "2026-09",
    );
    expect(filters).toEqual({
      month: "2026-07",
      memberId: "m",
      departmentName: "開発",
      role: "member",
      projectId: "p",
      projectType: "internal",
    });
    expect(
      parseEffortReportFilters(
        new URL(`http://localhost/?${effortReportSearch(filters)}`),
        { id: "admin", role: "admin" },
        "2026-09",
      ),
    ).toEqual(filters);
  });
  test.each(["", "2026-13", "invalid"])(
    "invalid month %s uses workspace month and cannot impersonate",
    (month) => {
      const filters = parseEffortReportFilters(
        new URL(`http://localhost/?month=${month}&memberId=other`),
        { id: "self", role: "member" },
        "2026-09",
      );
      expect(filters.month).toBe("2026-09");
      expect(filters.memberId).toBe("self");
    },
  );
  test("Japanese labels retain the three stored codes", () => {
    expect(projectTypeLabels).toEqual({
      billable: "請求対象",
      internal: "社内作業",
      non_billable: "非請求",
    });
  });
});
