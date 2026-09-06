// @vitest-environment node

import { beforeEach, afterEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import type { KosuDatabase } from "../../app/db/client";
import { findMemberByEmail } from "../../app/db/repositories/members";
import { commitImport, findMissingColumns, previewImport, type ImportType } from "../../app/services/import";
import { setupWorkspace } from "../../app/services/auth";

let db: KosuDatabase;
let connection: ReturnType<typeof createDatabaseConnection>;

beforeEach(async () => {
  connection = createDatabaseConnection(":memory:");
  db = connection.db;
  runMigrations(connection);
  await setupWorkspace(db, {
    workspaceName: "Acme",
    defaultTimezone: "Asia/Tokyo",
    administratorName: "Admin",
    administratorEmail: "admin@example.com",
    administratorPassword: "password123",
  });
});

afterEach(() => {
  connection.sqlite.close();
});

const memberHeader = ["email", "displayName", "role", "departmentName", "hourlyCostRate", "isActive"];

const requiredColumnsByType: Record<ImportType, string[]> = {
  members: ["email", "displayName"],
  projects: ["code", "name"],
  project_assignments: ["memberEmail", "projectCode"],
  member_monthly_capacities: ["memberEmail", "month", "capacityHours"],
  monthly_plans: ["memberEmail", "projectCode", "month", "plannedHours"],
};

describe("required column detection", () => {
  test("covers every import type with the columns its row validation depends on", () => {
    const types: ImportType[] = ["members", "projects", "project_assignments", "member_monthly_capacities", "monthly_plans"];

    for (const type of types) {
      expect(requiredColumnsByType[type].length).toBeGreaterThan(0);
      expect(findMissingColumns(type, requiredColumnsByType[type])).toEqual([]);
    }
  });

  test("reports every required column that is absent from the header row", () => {
    expect(findMissingColumns("member_monthly_capacities", ["memberEmail", "month"])).toEqual(["capacityHours"]);
    expect(findMissingColumns("monthly_plans", ["memberEmail", "projectCode"])).toEqual(["month", "plannedHours"]);
  });

  test("ignores surrounding whitespace in header names", () => {
    expect(findMissingColumns("members", [" email ", "displayName"])).toEqual([]);
  });
});

describe("preview with a missing required column", () => {
  test("marks every row invalid and names the missing column", () => {
    const preview = previewImport(
      db,
      "member_monthly_capacities",
      [
        ["memberEmail", "month"],
        ["admin@example.com", "2026-01"],
      ],
    );

    expect(preview.missingColumns).toEqual(["capacityHours"]);
    expect(preview.validRows).toBe(0);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0].errors[0]).toContain("必須列「capacityHours」が CSV に存在しません");
    expect(preview.rows[0].parsed).toBeUndefined();
  });

  test("does not commit any row when a required column is missing", async () => {
    const result = await commitImport(
      db,
      "member_monthly_capacities",
      [
        ["memberEmail", "month"],
        ["admin@example.com", "2026-01"],
        ["admin@example.com", "2026-02"],
      ],
      undefined,
      "actor",
    );

    expect(result).toEqual({ imported: 0, failed: 2, createdByMemberId: "actor" });
  });
});

describe("blank required values", () => {
  test("reports a blank capacity as a row error distinct from a missing column", () => {
    const preview = previewImport(
      db,
      "member_monthly_capacities",
      [
        ["memberEmail", "month", "capacityHours"],
        ["admin@example.com", "2026-01", ""],
      ],
    );

    expect(preview.missingColumns).toEqual([]);
    expect(preview.validRows).toBe(0);
    expect(preview.rows[0].errors).toContain("キャパシティを入力してください");
  });

  test("reports a blank planned-hours value as a row error", () => {
    const preview = previewImport(
      db,
      "monthly_plans",
      [
        ["memberEmail", "projectCode", "month", "assignmentRole", "plannedHours"],
        ["admin@example.com", "P-1", "2026-01", "", ""],
      ],
    );

    expect(preview.missingColumns).toEqual([]);
    expect(preview.rows[0].errors).toContain("予定時間を入力してください");
    expect(preview.rows[0].errors).not.toContain("必須列「plannedHours」が CSV に存在しません");
  });

  test("still accepts a valid non-blank value after the blank-value rule", () => {
    const preview = previewImport(
      db,
      "member_monthly_capacities",
      [
        ["memberEmail", "month", "capacityHours"],
        ["admin@example.com", "2026-01", "160"],
      ],
    );

    expect(preview.validRows).toBe(1);
    expect(preview.rows[0].errors).toEqual([]);
  });
});

describe("import commit atomicity", () => {
  test("commits all valid rows together", async () => {
    const result = await commitImport(
      db,
      "members",
      [memberHeader, ["new1@example.com", "New 1", "member", "", "", "true"], ["new2@example.com", "New 2", "member", "", "", "true"]],
      "testpass123",
      "actor",
    );

    expect(result).toEqual({ imported: 2, failed: 0, createdByMemberId: "actor" });
    expect(findMemberByEmail(db, "new1@example.com")).toBeDefined();
    expect(findMemberByEmail(db, "new2@example.com")).toBeDefined();
  });

  test("fails without persisting any rows when an apply error occurs mid-import", async () => {
    const result = await commitImport(
      db,
      "members",
      [memberHeader, ["new1@example.com", "New 1", "member", "", "", "true"], ["new2@example.com", "New 2", "member", "", "", "true"]],
      undefined,
      "actor",
    );

    expect(result).toEqual({ imported: 0, failed: 2, createdByMemberId: "actor" });
    expect(findMemberByEmail(db, "new1@example.com")).toBeUndefined();
    expect(findMemberByEmail(db, "new2@example.com")).toBeUndefined();
  });
});
