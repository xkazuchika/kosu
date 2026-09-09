// @vitest-environment node

import { beforeEach, afterEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import type { KosuDatabase } from "../../app/db/client";
import {
  createMember,
  deactivateMember,
  findMemberByEmail,
} from "../../app/db/repositories/members";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import { findMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import {
  archiveProject,
  createProject,
  findProjectByCode,
} from "../../app/db/repositories/projects";
import {
  commitImport,
  findMissingColumns,
  getImportTemplate,
  previewImport,
  type ImportType,
} from "../../app/services/import";
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

const memberHeader = [
  "email",
  "displayName",
  "role",
  "departmentName",
  "hourlyCostRate",
  "isActive",
];

const requiredColumnsByType: Record<ImportType, string[]> = {
  members: ["email", "displayName"],
  projects: ["code", "name"],
  project_assignments: ["memberEmail", "projectCode"],
  member_monthly_capacities: ["memberEmail", "month", "capacityHours"],
  monthly_plans: ["memberEmail", "projectCode", "month", "plannedHours"],
};

describe("required column detection", () => {
  test("covers every import type with the columns its row validation depends on", () => {
    const types: ImportType[] = [
      "members",
      "projects",
      "project_assignments",
      "member_monthly_capacities",
      "monthly_plans",
    ];

    for (const type of types) {
      expect(requiredColumnsByType[type].length).toBeGreaterThan(0);
      expect(findMissingColumns(type, requiredColumnsByType[type])).toEqual([]);
    }
  });

  test("reports every required column that is absent from the header row", () => {
    expect(
      findMissingColumns("member_monthly_capacities", ["memberEmail", "month"]),
    ).toEqual(["capacityHours"]);
    expect(
      findMissingColumns("monthly_plans", ["memberEmail", "projectCode"]),
    ).toEqual(["month", "plannedHours"]);
  });

  test("ignores surrounding whitespace in header names", () => {
    expect(findMissingColumns("members", [" email ", "displayName"])).toEqual(
      [],
    );
  });
});

describe("preview with a missing required column", () => {
  test("marks every row invalid and names the missing column", () => {
    const preview = previewImport(db, "member_monthly_capacities", [
      ["memberEmail", "month"],
      ["admin@example.com", "2026-01"],
    ]);

    expect(preview.missingColumns).toEqual(["capacityHours"]);
    expect(preview.validRows).toBe(0);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0].errors[0]).toContain(
      "必須列「capacityHours」が CSV に存在しません",
    );
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

    expect(result).toEqual({
      imported: 0,
      failed: 2,
      createdByMemberId: "actor",
    });
  });
});

describe("blank required values", () => {
  test("reports a blank capacity as a row error distinct from a missing column", () => {
    const preview = previewImport(db, "member_monthly_capacities", [
      ["memberEmail", "month", "capacityHours"],
      ["admin@example.com", "2026-01", ""],
    ]);

    expect(preview.missingColumns).toEqual([]);
    expect(preview.validRows).toBe(0);
    expect(preview.rows[0].errors).toContain("キャパシティを入力してください");
  });

  test("reports a blank planned-hours value as a row error", () => {
    const preview = previewImport(db, "monthly_plans", [
      ["memberEmail", "projectCode", "month", "assignmentRole", "plannedHours"],
      ["admin@example.com", "P-1", "2026-01", "", ""],
    ]);

    expect(preview.missingColumns).toEqual([]);
    expect(preview.rows[0].errors).toContain("予定時間を入力してください");
    expect(preview.rows[0].errors).not.toContain(
      "必須列「plannedHours」が CSV に存在しません",
    );
  });

  test("still accepts a valid non-blank value after the blank-value rule", () => {
    const preview = previewImport(db, "member_monthly_capacities", [
      ["memberEmail", "month", "capacityHours"],
      ["admin@example.com", "2026-01", "160"],
    ]);

    expect(preview.validRows).toBe(1);
    expect(preview.rows[0].errors).toEqual([]);
  });
});

describe("import commit atomicity", () => {
  test("commits all valid rows together", async () => {
    const result = await commitImport(
      db,
      "members",
      [
        memberHeader,
        ["new1@example.com", "New 1", "member", "", "", "true"],
        ["new2@example.com", "New 2", "member", "", "", "true"],
      ],
      "testpass123",
      "actor",
    );

    expect(result).toEqual({
      imported: 2,
      failed: 0,
      createdByMemberId: "actor",
    });
    expect(findMemberByEmail(db, "new1@example.com")).toBeDefined();
    expect(findMemberByEmail(db, "new2@example.com")).toBeDefined();
  });

  test("fails without persisting any rows when an apply error occurs mid-import", async () => {
    const result = await commitImport(
      db,
      "members",
      [
        memberHeader,
        ["new1@example.com", "New 1", "member", "", "", "true"],
        ["new2@example.com", "New 2", "member", "", "", "true"],
      ],
      undefined,
      "actor",
    );

    expect(result).toEqual({
      imported: 0,
      failed: 2,
      createdByMemberId: "actor",
    });
    expect(findMemberByEmail(db, "new1@example.com")).toBeUndefined();
    expect(findMemberByEmail(db, "new2@example.com")).toBeUndefined();
  });

  test("revalidates state changes and imports no valid sibling rows", async () => {
    const member = createMember(db, {
      displayName: "Target",
      email: "target@example.com",
      passwordHash: "hash",
    });
    const rows = [
      ["memberEmail", "month", "capacityHours"],
      ["target@example.com", "2026-07", "160"],
      ["admin@example.com", "2026-07", "160"],
    ];
    expect(previewImport(db, "member_monthly_capacities", rows).validRows).toBe(
      2,
    );
    deactivateMember(db, member.id);

    const result = await commitImport(
      db,
      "member_monthly_capacities",
      rows,
      undefined,
      "actor",
    );

    expect(result).toEqual({
      imported: 0,
      failed: 2,
      createdByMemberId: "actor",
    });
  });
});

describe("member CSV validation", () => {
  test("rejects invalid hourly rates and boolean flags without updating records", async () => {
    const admin = findMemberByEmail(db, "admin@example.com")!;
    const header = memberHeader;

    for (const rate of ["-1", "1.5", "abc", "9007199254740992"]) {
      const rows = [
        header,
        ["admin@example.com", "Changed", "admin", "", rate, "true"],
      ];
      expect(previewImport(db, "members", rows).invalidRows).toBe(1);
      expect(
        await commitImport(db, "members", rows, "password123", "actor"),
      ).toMatchObject({ imported: 0, failed: 1 });
    }

    for (const active of ["yes", "1", "active"]) {
      const preview = previewImport(db, "members", [
        header,
        ["new@example.com", "New", "member", "", "0", active],
      ]);
      expect(preview.rows[0].errors.join(" ")).toContain("true または false");
    }
    expect(findMemberByEmail(db, "admin@example.com")).toMatchObject({
      id: admin.id,
      displayName: admin.displayName,
      hourlyCostRate: admin.hourlyCostRate,
    });

    const project = createProject(db, {
      code: "RATE-SNAPSHOT",
      name: "Rate snapshot",
      projectType: "internal",
    });
    createProjectAssignment(db, {
      memberId: admin.id,
      projectId: project.id,
    });
    await commitImport(
      db,
      "monthly_plans",
      [
        ["memberEmail", "projectCode", "month", "assignmentRole", "plannedHours"],
        [admin.email, project.code, "2026-07", "", "8"],
      ],
      undefined,
      "actor",
    );
    expect(
      findMonthlyPlan(db, admin.id, project.id, "2026-07", "")
        ?.hourlyCostRateSnapshot,
    ).toBeNull();
  });
});

describe("CSV lifecycle parity", () => {
  test("rejects ineligible assignment, capacity, and monthly-plan targets", () => {
    const inactive = createMember(db, {
      displayName: "Inactive",
      email: "inactive@example.com",
      passwordHash: "hash",
      isActive: false,
    });
    const archived = createProject(db, {
      code: "ARCHIVED",
      name: "Archived",
      projectType: "internal",
    });
    archiveProject(db, archived.id, "2026-07-01T00:00:00.000Z");
    const active = createProject(db, {
      code: "ACTIVE",
      name: "Active",
      projectType: "internal",
    });

    const inactiveAssignment = previewImport(db, "project_assignments", [
      ["memberEmail", "projectCode", "assignmentRole", "assignmentSource"],
      [inactive.email, active.code, "", "admin"],
    ]);
    expect(inactiveAssignment.rows[0].errors.join(" ")).toContain(
      "無効なメンバー",
    );

    const archivedAssignment = previewImport(db, "project_assignments", [
      ["memberEmail", "projectCode", "assignmentRole", "assignmentSource"],
      ["admin@example.com", archived.code, "", "admin"],
    ]);
    expect(archivedAssignment.rows[0].errors.join(" ")).toContain(
      "アーカイブ済み",
    );

    const capacity = previewImport(db, "member_monthly_capacities", [
      ["memberEmail", "month", "capacityHours"],
      [inactive.email, "2026-07", "160"],
    ]);
    expect(capacity.rows[0].errors).toContain("メンバーが無効です");

    const unassignedPlan = previewImport(db, "monthly_plans", [
      ["memberEmail", "projectCode", "month", "assignmentRole", "plannedHours"],
      ["admin@example.com", active.code, "2026-07", "", "40"],
    ]);
    expect(unassignedPlan.rows[0].errors.join(" ")).toContain(
      "アサインされていません",
    );

    createProjectAssignment(db, {
      memberId: findMemberByEmail(db, "admin@example.com")!.id,
      projectId: active.id,
    });
    const duplicateAssignment = previewImport(db, "project_assignments", [
      ["memberEmail", "projectCode", "assignmentRole", "assignmentSource"],
      ["admin@example.com", active.code, "", "admin"],
    ]);
    expect(duplicateAssignment.rows[0].errors.join(" ")).toContain("既に");
  });
});

describe("project effort budget CSV", () => {
  test("supports new and older headers while preserving an absent existing budget", async () => {
    expect(getImportTemplate("projects")).toContain("effortBudgetHours");
    const newRows = [
      getImportTemplate("projects").split(","),
      ["P-1", "Project", "internal", "", "", "", "", "120.25"],
    ];
    expect(previewImport(db, "projects", newRows).validRows).toBe(1);
    await commitImport(db, "projects", newRows, undefined, "actor");
    expect(findProjectByCode(db, "P-1")?.effortBudgetHours).toBe(120.25);

    const olderRows = [
      [
        "code",
        "name",
        "projectType",
        "clientName",
        "revenueOrBudgetAmount",
        "contractRevenueAmount",
        "laborCostBudgetAmount",
      ],
      ["P-1", "Renamed", "internal", "", "", "", ""],
    ];
    expect(previewImport(db, "projects", olderRows).validRows).toBe(1);
    await commitImport(db, "projects", olderRows, undefined, "actor");
    expect(findProjectByCode(db, "P-1")).toMatchObject({
      name: "Renamed",
      effortBudgetHours: 120.25,
    });
  });

  test("rejects invalid effort budgets", () => {
    for (const value of ["-1", "1.1", "abc"]) {
      const preview = previewImport(db, "projects", [
        getImportTemplate("projects").split(","),
        ["P-1", "Project", "internal", "", "", "", "", value],
      ]);
      expect(preview.rows[0].errors.join(" ")).toContain("工数予算");
    }
  });
});
