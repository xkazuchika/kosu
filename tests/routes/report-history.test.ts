// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createDatabaseConnection } from "../../app/db/client";
import {
  createMember,
  listMembers,
  updateMember,
  deactivateMember,
} from "../../app/db/repositories/members";
import {
  createProject,
  archiveProject,
  updateProject,
  listEffortReportProjects,
} from "../../app/db/repositories/projects";
import {
  createDailyWorkLog,
  deleteDailyWorkLog,
} from "../../app/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  deleteEffortAllocation,
  findAllocationById,
} from "../../app/db/repositories/effort-allocations";
import {
  createMonthlyPlan,
  findMonthlyPlanById,
} from "../../app/db/repositories/monthly-plans";
import { parseCsv, neutralizeCsvCell } from "../../app/lib/csv";
import { loader } from "../../app/routes/reports";
import { action } from "../../app/routes/reports.export";
import { loader as plannedLoader } from "../../app/routes/reports.planned-vs-actual";
import { setEffortConfirmed } from "../support/monthly-cost-close-fixtures";
import {
  createMonthlyCostCloseProjectSnapshot,
  findMonthlyCostCloseByMonth,
  listMonthlyCostCloseProjectSnapshots,
} from "../../app/db/repositories/monthly-cost-closes";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import { saveDailyEffortEntry } from "../../app/services/daily-effort-entry";
import {
  setupAndLogin,
  buildContext,
  type RouteActionHandler,
} from "./helpers";

let dataDir: string;
let original: string | undefined;
beforeEach(() => {
  original = process.env.KOSU_DATA_DIR;
  dataDir = mkdtempSync(path.join(os.tmpdir(), "kosu-report-history-"));
});
afterEach(() => {
  if (original === undefined) delete process.env.KOSU_DATA_DIR;
  else process.env.KOSU_DATA_DIR = original;
  rmSync(dataDir, { recursive: true, force: true });
});

async function fixture() {
  const cookie = await setupAndLogin(dataDir, "password123");
  const connection = createDatabaseConnection();
  const { db } = connection;
  const admin = listMembers(db)[0];
  const other = createMember(db, {
    displayName: "Other",
    email: "other@example.com",
    passwordHash: "private-hash",
    departmentName: "旧部署",
    hourlyCostRate: 9876,
  });
  const project = createProject(db, {
    code: "OLD",
    name: "過去案件",
    projectType: "internal",
    contractRevenueAmount: 998877,
  });
  const log = createDailyWorkLog(db, {
    memberId: other.id,
    workDate: "2026-07-01",
    totalWorkingHours: 3,
  });
  const allocation = createEffortAllocation(db, {
    memberId: other.id,
    projectId: project.id,
    dailyWorkLogId: log.id,
    allocatedHours: 3,
    hourlyCostRateSnapshot: 1000,
    note: '=SUM(1,2)\n"備考"\r末尾',
  });
  const plan = createMonthlyPlan(db, {
    memberId: other.id,
    projectId: project.id,
    month: "2026-07",
    plannedHours: 4,
    hourlyCostRateSnapshot: 1000,
  });
  return {
    ...connection,
    cookie,
    admin,
    other,
    project,
    log,
    allocation,
    plan,
  };
}

async function exportRows(cookie: string, search: string) {
  const response = await (action as unknown as RouteActionHandler)({
    request: new Request(`http://localhost/reports/export?${search}`, {
      method: "POST",
      headers: { Cookie: cookie },
    }),
    params: {},
    context: buildContext(),
  });
  return parseCsv(await (response as Response).text());
}

test("current master changes preserve confirmed hours and cost snapshots and export the same rows", async () => {
  const f = await fixture();
  try {
    setEffortConfirmed(f.db, { month: "2026-07", actorMemberId: f.admin.id });
    const close = findMonthlyCostCloseByMonth(f.db, "2026-07")!;
    const snapshot = createMonthlyCostCloseProjectSnapshot(f.db, {
      closeId: close.id,
      projectId: f.project.id,
      projectCode: f.project.code,
      projectName: f.project.name,
      projectType: f.project.projectType,
      projectIsArchived: false,
      monthlyPlannedCost: 4000,
      monthlyActualCost: 3000,
      cumulativeActualCost: 3000,
    });
    updateMember(f.db, f.other.id, {
      displayName: "改名後",
      departmentName: "新部署",
      role: "admin",
      hourlyCostRate: 5000,
    });
    updateProject(f.db, f.project.id, {
      code: "NEW",
      name: "改名案件",
      projectType: "billable",
    });
    deactivateMember(f.db, f.other.id);
    archiveProject(f.db, f.project.id, new Date().toISOString());
    const search = new URLSearchParams({
      month: "2026-07",
      memberId: f.other.id,
      departmentName: "新部署",
      role: "admin",
      projectId: f.project.id,
      projectType: "billable",
    });
    const result = await loader({
      request: new Request(`http://localhost/reports?${search}`, {
        headers: { Cookie: f.cookie },
      }),
    });
    expect(result.closeStatus).toBe("confirmed");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      memberIsActive: false,
      projectIsArchived: true,
      allocatedHours: 3,
      memberName: "改名後",
      projectCode: "NEW",
      departmentName: "新部署",
      role: "admin",
      projectType: "billable",
      hourlyCostRateSnapshot: null,
    });
    expect(result.projects).toContainEqual({
      id: f.project.id,
      code: "NEW",
      name: "改名案件",
      isArchived: true,
    });
    const csv = await exportRows(f.cookie, result.exportSearch);
    expect(csv[0]).toEqual([
      "日付",
      "メンバー",
      "部署",
      "権限",
      "案件コード",
      "案件名",
      "種別",
      "タスク",
      "時間",
      "備考",
    ]);
    expect(csv.slice(1)).toEqual(
      result.rows.map((r) => [
        r.workDate,
        r.memberName,
        r.departmentName ?? "",
        r.role,
        r.projectCode,
        r.projectName,
        r.projectType,
        r.taskName ?? "",
        String(r.allocatedHours),
        neutralizeCsvCell(r.note ?? ""),
      ]),
    );
    expect(csv.slice(1).reduce((sum, r) => sum + Number(r[8]), 0)).toBe(3);
    expect(findAllocationById(f.db, f.allocation.id)).toMatchObject({
      allocatedHours: 3,
      hourlyCostRateSnapshot: 1000,
    });
    expect(findMonthlyCostCloseByMonth(f.db, "2026-07")).toEqual(close);
    expect(listMonthlyCostCloseProjectSnapshots(f.db, close.id)).toEqual([
      snapshot,
    ]);
    expect(findMonthlyPlanById(f.db, f.plan.id)).toEqual(f.plan);
    const planned = await plannedLoader({
      request: new Request(
        "http://localhost/reports/planned-vs-actual?month=2026-07",
        { headers: { Cookie: f.cookie } },
      ),
    });
    expect(planned.rows[0]).toMatchObject({
      memberIsActive: false,
      projectIsArchived: true,
      plannedHours: 4,
      actualHours: 3,
    });
    expect(planned.capacityRows[0].unallocatedCapacity).toBeNull();
    search.set("departmentName", "旧部署");
    expect(
      (
        await loader({
          request: new Request(`http://localhost/reports?${search}`, {
            headers: { Cookie: f.cookie },
          }),
        })
      ).rows,
    ).toEqual([]);
    expect(await exportRows(f.cookie, search.toString())).toHaveLength(1);
  } finally {
    f.sqlite.close();
  }
});

test("member historical choices exclude others and deleted effort across months", async () => {
  const f = await fixture();
  try {
    const active = createProject(f.db, {
      code: "ACTIVE",
      name: "有効案件",
      projectType: "internal",
    });
    const empty = createProject(f.db, {
      code: "EMPTY",
      name: "実績なし終了案件",
      projectType: "internal",
    });
    const own = createProject(f.db, {
      code: "OWN",
      name: "本人過去",
      projectType: "internal",
    });
    const gone = createProject(f.db, {
      code: "DELETED",
      name: "削除済みのみ",
      projectType: "internal",
    });
    const goneLog = createProject(f.db, {
      code: "DELETED-DAY",
      name: "削除日報のみ",
      projectType: "internal",
    });
    const log = createDailyWorkLog(f.db, {
      memberId: f.admin.id,
      workDate: "2026-07-02",
      totalWorkingHours: 6,
    });
    const insert = (projectId: string) =>
      createEffortAllocation(f.db, {
        memberId: f.admin.id,
        projectId,
        dailyWorkLogId: log.id,
        allocatedHours: 2,
      });
    insert(own.id);
    createMonthlyPlan(f.db, {
      memberId: f.admin.id,
      projectId: own.id,
      month: "2026-07",
      plannedHours: 5,
      assignmentRole: "Engineer",
    });
    const deleted = insert(gone.id);
    deleteEffortAllocation(f.db, deleted.id, new Date().toISOString());
    const day = createDailyWorkLog(f.db, {
      memberId: f.admin.id,
      workDate: "2026-07-03",
      totalWorkingHours: 1,
    });
    createEffortAllocation(f.db, {
      memberId: f.admin.id,
      projectId: goneLog.id,
      dailyWorkLogId: day.id,
      allocatedHours: 1,
    });
    deleteDailyWorkLog(f.db, day.id, new Date().toISOString());
    for (const p of [own, gone, goneLog, f.project, empty])
      archiveProject(f.db, p.id, new Date().toISOString());
    expect(
      listEffortReportProjects(f.db)
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      [active, empty, own, gone, goneLog, f.project].map((p) => p.id).sort(),
    );
    updateMember(f.db, f.admin.id, { role: "member" });
    expect(listEffortReportProjects(f.db, f.admin.id).map((p) => p.id)).toEqual(
      [active.id, own.id],
    );
    for (const month of ["2026-07", "2026-08"]) {
      const result = await loader({
        request: new Request(
          `http://localhost/reports?month=${month}&memberId=${f.other.id}`,
          { headers: { Cookie: f.cookie } },
        ),
      });
      expect(result.projects.map((p) => p.id)).toEqual([active.id, own.id]);
      expect(result.rows.every((r) => r.memberId === f.admin.id)).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(
        /private-hash|998877|9876|Other|過去案件/,
      );
      const csv = await exportRows(
        f.cookie,
        `month=${month}&memberId=${f.other.id}`,
      );
      expect(csv.slice(1)).toHaveLength(result.rows.length);
      expect(csv.flat()).not.toContain("Other");
      const planned = await plannedLoader({
        request: new Request(
          `http://localhost/reports/planned-vs-actual?month=${month}`,
          { headers: { Cookie: f.cookie } },
        ),
      });
      expect(planned.rows.every((r) => r.memberId === f.admin.id)).toBe(true);
      expect(planned.capacityRows.every((r) => r.memberId === f.admin.id)).toBe(
        true,
      );
      expect(JSON.stringify(planned)).not.toMatch(
        /private-hash|998877|9876|Other|過去案件|hourlyCostRate|passwordHash/,
      );
      if (month === "2026-07")
        expect(planned.rows).toContainEqual(
          expect.objectContaining({
            projectId: own.id,
            projectIsArchived: true,
            plannedHours: 5,
            actualHours: 2,
            assignmentRole: "Engineer",
          }),
        );
    }
  } finally {
    f.sqlite.close();
  }
});

test("every combined filter matches multiple ordered CSV rows, counts and hours", async () => {
  const f = await fixture();
  try {
    for (const [index, projectType] of (
      ["billable", "internal", "non_billable"] as const
    ).entries()) {
      const project = createProject(f.db, {
        code: `P-${index}`,
        name: `案件,"${index}"\r改行`,
        projectType,
      });
      const log = createDailyWorkLog(f.db, {
        memberId: f.admin.id,
        workDate: `2026-07-0${4 - index}`,
        totalWorkingHours: index + 1,
      });
      createEffortAllocation(f.db, {
        memberId: f.admin.id,
        projectId: project.id,
        dailyWorkLogId: log.id,
        allocatedHours: index + 1,
        note: "+1",
      });
    }
    const all = await loader({
      request: new Request("http://localhost/reports?month=2026-07", {
        headers: { Cookie: f.cookie },
      }),
    });
    const conditions = Object.entries({
      memberId: f.other.id,
      departmentName: "旧部署",
      role: "member",
      projectId: f.project.id,
      projectType: "internal",
    });
    for (let mask = 0; mask < 2 ** conditions.length; mask++) {
      const selected = conditions.filter((_, index) => mask & (1 << index));
      const search = new URLSearchParams([["month", "2026-07"], ...selected]);
      const result = await loader({
        request: new Request(`http://localhost/reports?${search}`, {
          headers: { Cookie: f.cookie },
        }),
      });
      expect(result.rows).toEqual(
        all.rows.filter((row) =>
          selected.every(
            ([key, value]) => row[key as keyof typeof row] === value,
          ),
        ),
      );
      const csv = await exportRows(f.cookie, result.exportSearch);
      expect(csv.slice(1)).toEqual(
        result.rows.map((r) => [
          r.workDate,
          neutralizeCsvCell(r.memberName),
          r.departmentName ?? "",
          r.role,
          r.projectCode,
          neutralizeCsvCell(r.projectName),
          r.projectType,
          r.taskName ?? "",
          String(r.allocatedHours),
          neutralizeCsvCell(r.note ?? ""),
        ]),
      );
      expect(csv.slice(1).reduce((sum, row) => sum + Number(row[8]), 0)).toBe(
        result.rows.reduce((sum, row) => sum + row.allocatedHours, 0),
      );
    }
    expect(all.rows.map((r) => r.workDate)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
    ]);
  } finally {
    f.sqlite.close();
  }
});

test("report visibility of archived projects does not allow new effort entry", async () => {
  const f = await fixture();
  try {
    createProjectAssignment(f.db, {
      memberId: f.other.id,
      projectId: f.project.id,
    });
    archiveProject(f.db, f.project.id, new Date().toISOString());
    expect(listEffortReportProjects(f.db, f.other.id)).toContainEqual(
      expect.objectContaining({ id: f.project.id, isArchived: true }),
    );
    expect(() =>
      saveDailyEffortEntry(f.db, {
        memberId: f.other.id,
        workDate: "2026-07-02",
        totalWorkingHours: 1,
        rows: [{ projectId: f.project.id, allocatedHours: 1 }],
      }),
    ).toThrow();
    deactivateMember(f.db, f.other.id);
    const result = await loader({
      request: new Request("http://localhost/reports?month=2026-07", {
        headers: { Cookie: f.cookie },
      }),
    });
    expect(result.rows).toContainEqual(
      expect.objectContaining({
        allocationId: f.allocation.id,
        allocatedHours: 3,
        memberIsActive: false,
        projectIsArchived: true,
      }),
    );
  } finally {
    f.sqlite.close();
  }
});

test("invalid month normalizes the page and CSV to the same empty result", async () => {
  const cookie = await setupAndLogin(dataDir, "password123");
  const result = await loader({
    request: new Request("http://localhost/reports?month=invalid", {
      headers: { Cookie: cookie },
    }),
  });
  expect(result.month).toMatch(/^\d{4}-\d{2}$/);
  expect(result.rows).toEqual([]);
  expect(await exportRows(cookie, result.exportSearch)).toHaveLength(1);
});

test("CSV resource rejects an unauthenticated request", async () => {
  await setupAndLogin(dataDir, "password123");
  await expect(
    (action as unknown as RouteActionHandler)({
      request: new Request("http://localhost/reports/export?month=2026-07", {
        method: "POST",
      }),
      params: {},
      context: buildContext(),
    }),
  ).rejects.toMatchObject({ status: 401 });
});
