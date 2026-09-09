// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import {
  createDailyWorkLog,
  deleteDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
} from "../../app/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  listAllocationsByWorkLog,
} from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import {
  findMonthlyEffortSubmission,
  submitMonthlyEffortSubmission,
} from "../../app/db/repositories/monthly-effort-submissions";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { archiveProject } from "../../app/db/repositories/projects";
import { archiveTask, createTask } from "../../app/db/repositories/tasks";
import { members } from "../../app/db/schema";
import { getCalendarMonth } from "../../app/lib/time";
import { action as periodLocksAction } from "../../app/routes/period-locks";
import {
  action as projectAssignmentsAction,
  loader as projectAssignmentsLoader,
} from "../../app/routes/projects.$id.assignments";
import { action as newProjectAction } from "../../app/routes/projects.new";
import { loader as projectsLoader } from "../../app/routes/projects";
import {
  action as workLogDateAction,
  loader as workLogDateLoader,
} from "../../app/routes/work-logs.$date";
import {
  action as workLogMonthAction,
  loader as workLogMonthLoader,
} from "../../app/routes/work-logs.month";
import {
  action as workLogWeekAction,
  loader as workLogWeekLoader,
} from "../../app/routes/work-logs.week";
import { loader as workLogsLoader } from "../../app/routes/work-logs";
import {
  buildContext,
  buildRequest,
  setupAndLogin,
  type RouteActionHandler,
  type RouteLoaderHandler,
} from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(
    os.tmpdir(),
    `kosu-work-logs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
}

beforeEach(() => {
  dataDir = tempDataDir();
  mkdirSync(dataDir, { recursive: true });
  originalDataDir = process.env.KOSU_DATA_DIR;
});

afterEach(() => {
  if (originalDataDir !== undefined) {
    process.env.KOSU_DATA_DIR = originalDataDir;
  } else {
    delete process.env.KOSU_DATA_DIR;
  }

  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

async function createProject(
  cookie: string,
  code: string,
  name: string,
  type = "internal",
) {
  const formData = new FormData();
  formData.append("code", code);
  formData.append("name", name);
  formData.append("projectType", type);

  return (newProjectAction as unknown as RouteActionHandler)({
    request: buildRequest(formData, cookie),
    params: {},
    context: buildContext(),
  });
}

async function assignAdminToProject(cookie: string, projectId: string) {
  const assignmentsResponse = await (
    projectAssignmentsLoader as unknown as RouteLoaderHandler
  )({
    request: new Request(`http://localhost/projects/${projectId}/assignments`, {
      headers: { Cookie: cookie },
    }),
    params: { id: projectId },
    context: buildContext(),
  });
  const adminMember = (assignmentsResponse as { members: { id: string }[] })
    .members[0];

  const assignForm = new FormData();
  assignForm.append("memberId", adminMember.id);
  assignForm.append("assignmentRole", "Engineer");

  await (projectAssignmentsAction as unknown as RouteActionHandler)({
    request: buildRequest(assignForm, cookie),
    params: { id: projectId },
    context: buildContext(),
  });

  return adminMember;
}

function buildSaveDayForm(input: {
  totalWorkingHours: number | string;
  rows?: {
    allocationId?: string;
    projectId?: string;
    taskId?: string;
    allocatedHours?: number | string;
    note?: string;
  }[];
  intent?: string;
}) {
  const formData = new FormData();
  formData.append("intent", input.intent ?? "saveDay");
  formData.append("totalWorkingHours", String(input.totalWorkingHours));

  for (const row of input.rows ?? []) {
    formData.append("allocationId", row.allocationId ?? "");
    formData.append("projectId", row.projectId ?? "");
    formData.append("taskId", row.taskId ?? "");
    formData.append(
      "allocatedHours",
      row.allocatedHours === undefined ? "" : String(row.allocatedHours),
    );
    formData.append("note", row.note ?? "");
  }

  return formData;
}

describe("daily work logs and allocations", () => {
  test("monthly submission exposes member state and rejects actionable unbalanced dates", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");
    const month = getCalendarMonth(new Date(), "Asia/Tokyo");
    const submitForm = new FormData();
    submitForm.append("intent", "submitMonth");

    const submitResponse = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request(`http://localhost/work-logs/month?month=${month}`, {
        method: "POST",
        body: submitForm,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(submitResponse).toBeInstanceOf(Response);

    let loaded = (await (workLogMonthLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/work-logs/month?month=${month}`, {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    })) as {
      submission: {
        status: string;
        submittedByName: string | null;
        unbalancedDates: string[];
      };
    };
    expect(loaded.submission).toMatchObject({
      status: "submitted",
      submittedByName: "Admin",
      unbalancedDates: [],
    });

    const workDate = `${month}-01`;
    const totalsForm = new FormData();
    totalsForm.append("intent", "saveTotals");
    totalsForm.append("date", workDate);
    totalsForm.append("totalWorkingHours", "8");
    await (workLogMonthAction as unknown as RouteActionHandler)({
      request: new Request(`http://localhost/work-logs/month?month=${month}`, {
        method: "POST",
        body: totalsForm,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });

    loaded = (await (workLogMonthLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/work-logs/month?month=${month}`, {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    })) as typeof loaded;
    expect(loaded.submission).toMatchObject({
      status: "draft",
      unbalancedDates: [workDate],
    });

    const rejected = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request(`http://localhost/work-logs/month?month=${month}`, {
        method: "POST",
        body: submitForm,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(rejected).toMatchObject({ unbalancedDates: [workDate] });
  });

  test("administrator can proxy-submit an inactive member with evidence", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const month = getCalendarMonth(new Date(), "Asia/Tokyo");
    const connection = createDatabaseConnection();
    const target = createMember(connection.db, {
      displayName: "Inactive Member",
      email: "inactive@example.com",
      passwordHash: "unused",
      isActive: false,
    });
    createDailyWorkLog(connection.db, {
      memberId: target.id,
      workDate: `${month}-01`,
      totalWorkingHours: 0,
    });
    connection.sqlite.close();
    const formData = new FormData();
    formData.append("intent", "submitMonth");

    await (workLogMonthAction as unknown as RouteActionHandler)({
      request: new Request(
        `http://localhost/work-logs/month?month=${month}&memberId=${target.id}`,
        { method: "POST", body: formData, headers: { Cookie: cookie } },
      ),
      params: {},
      context: buildContext(),
    });
    const loaded = (await (workLogMonthLoader as unknown as RouteLoaderHandler)(
      {
        request: new Request(
          `http://localhost/work-logs/month?month=${month}&memberId=${target.id}`,
          { headers: { Cookie: cookie } },
        ),
        context: buildContext(),
      },
    )) as {
      members: { id: string }[];
      submission: {
        isRequired: boolean;
        status: string;
        submittedByName: string | null;
      };
    };
    expect(loaded.members.map((member) => member.id)).toContain(target.id);
    expect(loaded.submission).toMatchObject({
      isRequired: true,
      status: "submitted",
      submittedByName: "Admin",
    });
  });

  test("total-only, previous-day copy, and allocation delete invalidate in the same route write", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-INV", "Invalidation", "internal");
    const projectsResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    const project = (
      projectsResponse as { projects: { id: string; code: string }[] }
    ).projects.find((entry) => entry.code === "PRJ-INV")!;
    const admin = await assignAdminToProject(cookie, project.id);
    const connection = createDatabaseConnection();
    const previous = createDailyWorkLog(connection.db, {
      memberId: admin.id,
      workDate: "2026-07-14",
      totalWorkingHours: 8,
    });
    const previousAllocation = createEffortAllocation(connection.db, {
      dailyWorkLogId: previous.id,
      memberId: admin.id,
      projectId: project.id,
      allocatedHours: 8,
    });
    submitMonthlyEffortSubmission(connection.db, {
      memberId: admin.id,
      month: "2026-07",
      actorMemberId: admin.id,
      submittedAt: "2026-08-01T00:00:00.000Z",
    });
    connection.sqlite.close();

    const totalForm = new FormData();
    totalForm.append("intent", "saveWorkLog");
    totalForm.append("totalWorkingHours", "4");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(totalForm, cookie),
      params: { date: "2026-07-16" },
      context: buildContext(),
    });
    let check = createDatabaseConnection();
    expect(
      findMonthlyEffortSubmission(check.db, admin.id, "2026-07"),
    ).toMatchObject({
      status: "draft",
      invalidatedByMemberId: admin.id,
    });
    submitMonthlyEffortSubmission(check.db, {
      memberId: admin.id,
      month: "2026-07",
      actorMemberId: admin.id,
      submittedAt: "2026-08-01T01:00:00.000Z",
    });
    check.sqlite.close();

    const copyForm = new FormData();
    copyForm.append("intent", "copyPrevious");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(copyForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    check = createDatabaseConnection();
    expect(
      findMonthlyEffortSubmission(check.db, admin.id, "2026-07")?.status,
    ).toBe("draft");
    const copiedLog = findDailyWorkLogByMemberAndDate(
      check.db,
      admin.id,
      "2026-07-15",
    )!;
    expect(listAllocationsByWorkLog(check.db, copiedLog.id)).toHaveLength(1);
    submitMonthlyEffortSubmission(check.db, {
      memberId: admin.id,
      month: "2026-07",
      actorMemberId: admin.id,
      submittedAt: "2026-08-01T02:00:00.000Z",
    });
    check.sqlite.close();

    const deleteForm = new FormData();
    deleteForm.append("deleteAllocationId", previousAllocation.id);
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(deleteForm, cookie),
      params: { date: "2026-07-14" },
      context: buildContext(),
    });
    check = createDatabaseConnection();
    expect(
      findMonthlyEffortSubmission(check.db, admin.id, "2026-07")?.status,
    ).toBe("draft");
    check.sqlite.close();
  });

  test("member bulk edits monthly daily totals", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "8");
    formData.append("date", "2026-07-02");
    formData.append("totalWorkingHours", "7.5");

    const response = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: formData,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/work-logs/month?month=2026-07",
    );

    const monthResponse = await (
      workLogMonthLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const rows = (
      monthResponse as {
        rows: {
          isSaturday: boolean;
          isSunday: boolean;
          totalWorkingHours: number;
          workDate: string;
        }[];
      }
    ).rows;
    expect(rows).toHaveLength(31);
    expect(
      rows.find((row) => row.workDate === "2026-07-01")?.totalWorkingHours,
    ).toBe(8);
    expect(
      rows.find((row) => row.workDate === "2026-07-02")?.totalWorkingHours,
    ).toBe(7.5);
    expect(rows.find((row) => row.workDate === "2026-07-04")).toMatchObject({
      isSaturday: true,
      isSunday: false,
    });
    expect(rows.find((row) => row.workDate === "2026-07-05")).toMatchObject({
      isSaturday: false,
      isSunday: true,
    });
  });

  test("monthly work log rejects invalid bulk hours", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");
    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "8.13");

    const response = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: formData,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect((response as { error: string }).error).toContain("0.25h");
  });

  test("monthly work log rejects impossible dates and values over 24 hours", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");
    const impossibleDate = new FormData();
    impossibleDate.append("date", "2026-07-32");
    impossibleDate.append("totalWorkingHours", "8");

    const invalidDateResponse = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: impossibleDate,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect((invalidDateResponse as { error: string }).error).toContain(
      "対象月の日付",
    );

    const overDay = new FormData();
    overDay.append("date", "2026-07-01");
    overDay.append("totalWorkingHours", "24.25");
    const overDayResponse = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: overDay,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect((overDayResponse as { error: string }).error).toContain("24h 以下");
  });

  test("monthly bulk edit does not save valid rows when a later row is invalid", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "8");
    formData.append("date", "2026-07-02");
    formData.append("totalWorkingHours", "8.13");

    const response = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: formData,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect((response as { error: string }).error).toContain("0.25h");

    const monthResponse = await (
      workLogMonthLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const rows = (
      monthResponse as {
        rows: { status: string; totalWorkingHours: number; workDate: string }[];
      }
    ).rows;
    expect(
      rows.find((row) => row.workDate === "2026-07-01")?.totalWorkingHours,
    ).toBe(0);
    expect(rows.find((row) => row.workDate === "2026-07-01")?.status).toBe(
      "missing",
    );
    expect(
      rows.find((row) => row.workDate === "2026-07-02")?.totalWorkingHours,
    ).toBe(0);
  });

  test("monthly bulk edit clears a day with zero when no allocations exist", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    const createForm = new FormData();
    createForm.append("date", "2026-07-01");
    createForm.append("totalWorkingHours", "8");
    await (workLogMonthAction as unknown as RouteActionHandler)({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: createForm,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });

    const clearForm = new FormData();
    clearForm.append("date", "2026-07-01");
    clearForm.append("totalWorkingHours", "0");
    const clearResponse = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: clearForm,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(clearResponse).toBeInstanceOf(Response);

    const monthResponse = await (
      workLogMonthLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const rows = (
      monthResponse as {
        rows: { status: string; totalWorkingHours: number; workDate: string }[];
      }
    ).rows;
    expect(
      rows.find((row) => row.workDate === "2026-07-01")?.totalWorkingHours,
    ).toBe(0);
    expect(rows.find((row) => row.workDate === "2026-07-01")?.status).toBe(
      "missing",
    );

    const reenterForm = new FormData();
    reenterForm.append("date", "2026-07-01");
    reenterForm.append("totalWorkingHours", "7");
    const reenterResponse = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: reenterForm,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(reenterResponse).toBeInstanceOf(Response);

    const restoredMonth = await (
      workLogMonthLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    expect(
      (
        restoredMonth as {
          rows: { totalWorkingHours: number; workDate: string }[];
        }
      ).rows.find((row) => row.workDate === "2026-07-01")?.totalWorkingHours,
    ).toBe(7);
  });

  test("monthly bulk edit rejects zero for a day with allocations", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const setupConnection = createDatabaseConnection();
    const member = createMember(setupConnection.db, {
      displayName: "Member",
      email: "member@example.com",
      passwordHash: "unused",
      role: "member",
    });
    setupConnection.sqlite.close();

    await createProject(cookie, "PRJ-001", "Website", "internal");
    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];

    const assignForm = new FormData();
    assignForm.append("memberId", member.id);
    assignForm.append("assignmentRole", "Engineer");
    await (projectAssignmentsAction as unknown as RouteActionHandler)({
      request: buildRequest(assignForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });

    const workLogForm = new FormData();
    workLogForm.append("date", "2026-07-01");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogMonthAction as unknown as RouteActionHandler)({
      request: new Request(
        `http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`,
        {
          method: "POST",
          body: workLogForm,
          headers: { Cookie: cookie },
        },
      ),
      params: {},
      context: buildContext(),
    });

    const logConnection = createDatabaseConnection();
    const log = findDailyWorkLogByMemberAndDate(
      logConnection.db,
      member.id,
      "2026-07-01",
    )!;
    createEffortAllocation(logConnection.db, {
      dailyWorkLogId: log.id,
      memberId: member.id,
      projectId: project.id,
      taskId: null,
      allocatedHours: 8,
      note: null,
      hourlyCostRateSnapshot: null,
    });
    logConnection.sqlite.close();

    const clearForm = new FormData();
    clearForm.append("date", "2026-07-01");
    clearForm.append("totalWorkingHours", "0");
    const clearResponse = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request(
        `http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`,
        {
          method: "POST",
          body: clearForm,
          headers: { Cookie: cookie },
        },
      ),
      params: {},
      context: buildContext(),
    });
    expect((clearResponse as { error: string }).error).toContain(
      "0h にできません",
    );

    const monthResponse = await (
      workLogMonthLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        `http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`,
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    expect(
      (
        monthResponse as {
          rows: { totalWorkingHours: number; workDate: string }[];
        }
      ).rows.find((row) => row.workDate === "2026-07-01")?.totalWorkingHours,
    ).toBe(8);
  });

  test("admin bulk edits selected member month", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection();
    const member = createMember(connection.db, {
      displayName: "Member",
      email: "member@example.com",
      passwordHash: "unused",
      role: "member",
    });
    connection.sqlite.close();

    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "6");

    const response = await (
      workLogMonthAction as unknown as RouteActionHandler
    )({
      request: new Request(
        `http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`,
        {
          method: "POST",
          body: formData,
          headers: { Cookie: cookie },
        },
      ),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      `/work-logs/month?month=2026-07&memberId=${member.id}`,
    );

    const monthResponse = await (
      workLogMonthLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        `http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`,
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    expect(
      (monthResponse as { targetMember: { id: string } }).targetMember.id,
    ).toBe(member.id);
    expect(
      (monthResponse as { rows: { totalWorkingHours: number }[] }).rows[0]
        .totalWorkingHours,
    ).toBe(6);
  });

  test("locked month prevents member monthly bulk edit", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const lockForm = new FormData();
    lockForm.append("intent", "startReview");
    lockForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const connection = createDatabaseConnection();
    connection.db
      .update(members)
      .set({ role: "member" })
      .where(eq(members.email, "admin@example.com"))
      .run();
    connection.sqlite.close();

    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "8");

    await expect(
      (workLogMonthAction as unknown as RouteActionHandler)({
        request: new Request("http://localhost/work-logs/month?month=2026-07", {
          method: "POST",
          body: formData,
          headers: { Cookie: cookie },
        }),
        params: {},
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  test("member creates and lists daily work log", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const formData = buildSaveDayForm({ totalWorkingHours: 8 });

    const actionResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(formData, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((actionResponse as { success: string }).success).toContain(
      "保存しました",
    );

    const listResponse = await (
      workLogsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const logs = (
      listResponse as {
        logs: { workDate: string; totalWorkingHours: number }[];
      }
    ).logs;
    expect(
      logs.some(
        (log) => log.workDate === "2026-07-15" && log.totalWorkingHours === 8,
      ),
    ).toBe(true);
  });

  test("filters a member's selected month to unbalanced work logs", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const projectsResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (projectsResponse as { projects: { id: string }[] })
      .projects[0];
    await assignAdminToProject(cookie, project.id);

    for (const date of ["2026-07-15", "2026-08-01"]) {
      await (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(
          buildSaveDayForm({ totalWorkingHours: 8 }),
          cookie,
        ),
        params: { date },
        context: buildContext(),
      });
    }

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 8 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-16" },
      context: buildContext(),
    });

    const listResponse = await (
      workLogsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/work-logs?month=2026-07&status=unbalanced",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    const data = listResponse as {
      month: string;
      status: string;
      logs: { workDate: string; variance: number }[];
    };

    expect(data.month).toBe("2026-07");
    expect(data.status).toBe("unbalanced");
    expect(data.logs).toEqual([
      expect.objectContaining({ workDate: "2026-07-15", variance: 8 }),
    ]);
  });

  test("admin filters the selected member's unbalanced work logs", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection();
    const targetMember = createMember(connection.db, {
      displayName: "Member",
      email: "member@example.com",
      passwordHash: "unused",
      role: "member",
    });
    createDailyWorkLog(connection.db, {
      memberId: targetMember.id,
      workDate: "2026-07-15",
      totalWorkingHours: 8,
    });
    createDailyWorkLog(connection.db, {
      memberId: targetMember.id,
      workDate: "2026-08-01",
      totalWorkingHours: 8,
    });
    connection.sqlite.close();

    const listResponse = await (
      workLogsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        `http://localhost/work-logs?memberId=${targetMember.id}&month=2026-07&status=unbalanced`,
        {
          headers: { Cookie: cookie },
        },
      ),
      context: buildContext(),
    });
    const data = listResponse as {
      targetMember: { id: string };
      logs: { workDate: string }[];
    };

    expect(data.targetMember.id).toBe(targetMember.id);
    expect(data.logs).toEqual([
      expect.objectContaining({ workDate: "2026-07-15" }),
    ]);
  });

  test("work log list falls back to the current month for an invalid month filter", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const listResponse = await (
      workLogsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs?month=2026-13", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });

    expect((listResponse as { month: string }).month).toBe(
      getCalendarMonth(new Date(), "Asia/Tokyo"),
    );
  });

  test("work log list redirects date query to daily entry", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    try {
      await (workLogsLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/work-logs?date=2026-07-15", {
          headers: { Cookie: cookie },
        }),
        context: buildContext(),
      });
      throw new Error("Expected redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).headers.get("Location")).toBe(
        "/work-logs/2026-07-15",
      );
    }
  });

  test("admin work log date redirect preserves selected member", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection();
    const member = createMember(connection.db, {
      displayName: "Member",
      email: "member@example.com",
      passwordHash: "unused",
      role: "member",
    });
    connection.sqlite.close();

    try {
      await (workLogsLoader as unknown as RouteLoaderHandler)({
        request: new Request(
          `http://localhost/work-logs?memberId=${member.id}&date=2026-07-15`,
          { headers: { Cookie: cookie } },
        ),
        context: buildContext(),
      });
      throw new Error("Expected redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).headers.get("Location")).toBe(
        `/work-logs/2026-07-15?memberId=${member.id}`,
      );
    }
  });

  test("member adds allocation to assigned project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];
    await assignAdminToProject(cookie, project.id);

    const allocationResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [
            { projectId: project.id, allocatedHours: 6.25, note: "Backend" },
          ],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((allocationResponse as { success: string }).success).toContain(
      "1 件",
    );

    const detailResponse = await (
      workLogDateLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/2026-07-15", {
        headers: { Cookie: cookie },
      }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect(
      (detailResponse as { workLog: { totalWorkingHours: number } | null })
        .workLog?.totalWorkingHours,
    ).toBe(8);
    const allocations = (
      detailResponse as { allocations: { allocatedHours: number }[] }
    ).allocations;
    const allocatedTotal = allocations.reduce(
      (sum, a) => sum + a.allocatedHours,
      0,
    );
    expect(allocatedTotal).toBe(6.25);
    expect(8 - allocatedTotal).toBe(1.75);
  });

  test("member updates existing allocation hours and note", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];
    await assignAdminToProject(cookie, project.id);

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 4, note: "Initial" }],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const detailResponse = await (
      workLogDateLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/2026-07-15", {
        headers: { Cookie: cookie },
      }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const allocationId = (detailResponse as { allocations: { id: string }[] })
      .allocations[0].id;

    const updateResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [
            {
              allocationId,
              projectId: project.id,
              allocatedHours: 6.5,
              note: "Updated",
            },
          ],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((updateResponse as { success: string }).success).toContain("1 件");

    const updatedDetailResponse = await (
      workLogDateLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/2026-07-15", {
        headers: { Cookie: cookie },
      }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const updatedAllocation = (
      updatedDetailResponse as {
        allocations: { allocatedHours: number; note: string | null }[];
      }
    ).allocations[0];
    expect(updatedAllocation.allocatedHours).toBe(6.5);
    expect(updatedAllocation.note).toBe("Updated");
  });

  test("rejects non-quarter-hour values", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const formData = buildSaveDayForm({ totalWorkingHours: 8.13 });

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(formData, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect((response as { error: string }).error).toContain("0.25h");
  });

  test("rejects zero-hour work logs and allocations", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];
    await assignAdminToProject(cookie, project.id);

    const zeroWorkLogForm = buildSaveDayForm({ totalWorkingHours: 0 });

    const zeroWorkLogResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(zeroWorkLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((zeroWorkLogResponse as { error: string }).error).toContain("0.25h");

    const zeroAllocationForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [{ projectId: project.id, allocatedHours: 0 }],
    });

    const zeroAllocationResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(zeroAllocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((zeroAllocationResponse as { error: string }).error).toContain(
      "0.25h",
    );
  });

  test("member cannot allocate to unassigned project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];

    const allocationForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [{ projectId: project.id, allocatedHours: 4 }],
    });

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(allocationForm, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect((response as { error: string }).error).toContain(
      "アサインされていない",
    );
  });

  test("member allocates to an active task on the selected project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];
    await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection();
    const task = createTask(connection.db, {
      projectId: project.id,
      name: "Backend",
    });
    connection.sqlite.close();

    const allocationResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, taskId: task.id, allocatedHours: 4 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((allocationResponse as { success: string }).success).toContain(
      "1 件",
    );

    const detailResponse = await (
      workLogDateLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/2026-07-15", {
        headers: { Cookie: cookie },
      }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect(
      (detailResponse as { allocations: { taskId: string | null }[] })
        .allocations[0]?.taskId,
    ).toBe(task.id);
    expect(
      (detailResponse as { activeTasks: { id: string }[] }).activeTasks.some(
        (activeTask) => activeTask.id === task.id,
      ),
    ).toBe(true);
  });

  test("rejects archived projects and invalid task selections", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");
    await createProject(cookie, "PRJ-002", "Mobile", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const projects = (
      listResponse as { projects: { id: string; code: string }[] }
    ).projects;
    const project = projects.find((item) => item.code === "PRJ-001")!;
    const otherProject = projects.find((item) => item.code === "PRJ-002")!;
    await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection();
    const task = createTask(connection.db, {
      projectId: project.id,
      name: "Backend",
    });
    const otherTask = createTask(connection.db, {
      projectId: otherProject.id,
      name: "Mobile",
    });
    archiveTask(connection.db, task.id, "2026-07-01T00:00:00Z");
    connection.sqlite.close();

    const archivedTaskForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [{ projectId: project.id, taskId: task.id, allocatedHours: 4 }],
    });

    const archivedTaskResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(archivedTaskForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((archivedTaskResponse as { error: string }).error).toContain(
      "タスク",
    );

    const mismatchedTaskForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [
        { projectId: project.id, taskId: otherTask.id, allocatedHours: 4 },
      ],
    });

    const mismatchedTaskResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(mismatchedTaskForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((mismatchedTaskResponse as { error: string }).error).toContain(
      "タスク",
    );

    const archiveConnection = createDatabaseConnection();
    archiveProject(archiveConnection.db, project.id, "2026-07-01T00:00:00Z");
    archiveConnection.sqlite.close();

    const archivedProjectForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [{ projectId: project.id, allocatedHours: 4 }],
    });

    const archivedProjectResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(archivedProjectForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((archivedProjectResponse as { error: string }).error).toContain(
      "有効な案件",
    );
  });

  test("locked month prevents work log edit", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const lockForm = new FormData();
    lockForm.append("intent", "startReview");
    lockForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const formData = buildSaveDayForm({ totalWorkingHours: 8 });

    await expect(
      (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(formData, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  test("allocation delete rejects mismatched route date", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] })
      .projects[0];
    await assignAdminToProject(cookie, project.id);

    const allocationForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [{ projectId: project.id, allocatedHours: 4 }],
    });
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(allocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const detailResponse = await (
      workLogDateLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/work-logs/2026-07-15", {
        headers: { Cookie: cookie },
      }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const allocationId = (detailResponse as { allocations: { id: string }[] })
      .allocations[0].id;

    const deleteForm = new FormData();
    deleteForm.append("deleteAllocationId", allocationId);

    await expect(
      (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(deleteForm, cookie),
        params: { date: "2026-07-16" },
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });
});

describe("allocation edits keep unassignable references", () => {
  async function seedAllocation(
    cookie: string,
    workDate: string,
    projectCode: string,
    projectName: string,
  ) {
    await createProject(cookie, projectCode, projectName);
    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (
      listResponse as { projects: { id: string; code: string }[] }
    ).projects.find((candidate) => candidate.code === projectCode)!;
    await assignAdminToProject(cookie, project.id);

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 4 }],
        }),
        cookie,
      ),
      params: { date: workDate },
      context: buildContext(),
    });

    return project;
  }

  function loadDetail(cookie: string, workDate: string) {
    return (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/work-logs/${workDate}`, {
        headers: { Cookie: cookie },
      }),
      params: { date: workDate },
      context: buildContext(),
    });
  }

  test("entry screen keeps an archived project selectable with a state label", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await seedAllocation(
      cookie,
      "2026-07-20",
      "ARCH-1",
      "Archived project",
    );

    const connection = createDatabaseConnection();
    try {
      archiveProject(connection.db, project.id, new Date().toISOString());
    } finally {
      connection.sqlite.close();
    }

    const detail = (await loadDetail(cookie, "2026-07-20")) as {
      assignedProjects: { id: string }[];
      referencedOnlyProjectIds: string[];
      allocations: { projectId: string }[];
    };

    expect(detail.allocations[0].projectId).toBe(project.id);
    expect(detail.assignedProjects.map((candidate) => candidate.id)).toContain(
      project.id,
    );
    expect(detail.referencedOnlyProjectIds).toContain(project.id);
  });

  test("updating hours keeps an archived project instead of moving the allocation", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await seedAllocation(
      cookie,
      "2026-07-21",
      "ARCH-2",
      "Archived project 2",
    );

    const connection = createDatabaseConnection();
    try {
      archiveProject(connection.db, project.id, new Date().toISOString());
    } finally {
      connection.sqlite.close();
    }

    const before = (await loadDetail(cookie, "2026-07-21")) as {
      allocations: { id: string }[];
    };
    const allocationId = before.allocations[0].id;

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(
          buildSaveDayForm({
            totalWorkingHours: 8,
            rows: [{ allocationId, projectId: project.id, allocatedHours: 6 }],
          }),
          cookie,
        ),
        params: { date: "2026-07-21" },
        context: buildContext(),
      },
    );
    expect((response as { success: string }).success).toContain("1 件");

    const after = (await loadDetail(cookie, "2026-07-21")) as {
      allocations: { projectId: string; allocatedHours: number }[];
    };
    expect(after.allocations[0].projectId).toBe(project.id);
    expect(after.allocations[0].allocatedHours).toBe(6);
  });

  test("rejects changing an allocation to a project that is archived or unassigned", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const original = await seedAllocation(
      cookie,
      "2026-07-22",
      "MOVE-1",
      "Original project",
    );
    await createProject(cookie, "MOVE-2", "Archived target");
    const projectsResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const archived = (
      projectsResponse as { projects: { id: string; code: string }[] }
    ).projects.find((candidate) => candidate.code === "MOVE-2")!;
    await assignAdminToProject(cookie, archived.id);

    const connection = createDatabaseConnection();
    try {
      archiveProject(connection.db, archived.id, new Date().toISOString());
    } finally {
      connection.sqlite.close();
    }

    const detail = (await loadDetail(cookie, "2026-07-22")) as {
      allocations: { id: string; projectId: string }[];
    };
    const allocation = detail.allocations.find(
      (candidate) => candidate.projectId === original.id,
    )!;

    const updateForm = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [
        {
          allocationId: allocation.id,
          projectId: archived.id,
          allocatedHours: 4,
        },
      ],
    });

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(updateForm, cookie),
        params: { date: "2026-07-22" },
        context: buildContext(),
      },
    );
    expect((response as { error: string }).error).toContain("有効な案件");

    const after = (await loadDetail(cookie, "2026-07-22")) as {
      allocations: { projectId: string }[];
    };
    expect(
      after.allocations.find(
        (candidate) => candidate.projectId === original.id,
      ),
    ).toBeDefined();
  });

  test("updating hours keeps an archived task on the allocation", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await seedAllocation(
      cookie,
      "2026-07-23",
      "TASK-1",
      "Task project",
    );

    const connection = createDatabaseConnection();
    let taskId: string;
    try {
      const task = createTask(connection.db, {
        projectId: project.id,
        name: "Archived task",
      });
      taskId = task.id;
    } finally {
      connection.sqlite.close();
    }

    const detail = (await loadDetail(cookie, "2026-07-23")) as {
      allocations: { id: string }[];
    };
    const allocationId = detail.allocations[0].id;

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [
            { allocationId, projectId: project.id, taskId, allocatedHours: 4 },
          ],
        }),
        cookie,
      ),
      params: { date: "2026-07-23" },
      context: buildContext(),
    });

    const archiveConnection = createDatabaseConnection();
    try {
      archiveTask(archiveConnection.db, taskId, new Date().toISOString());
    } finally {
      archiveConnection.sqlite.close();
    }

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(
          buildSaveDayForm({
            totalWorkingHours: 8,
            rows: [{ allocationId, projectId: project.id, allocatedHours: 5 }],
          }),
          cookie,
        ),
        params: { date: "2026-07-23" },
        context: buildContext(),
      },
    );
    expect((response as { success: string }).success).toContain("1 件");

    const after = (await loadDetail(cookie, "2026-07-23")) as {
      allocations: { taskId: string | null; allocatedHours: number }[];
      activeTasks: { id: string }[];
    };
    expect(after.allocations[0].taskId).toBe(taskId);
    expect(after.allocations[0].allocatedHours).toBe(5);
    expect(after.activeTasks.map((task) => task.id)).toContain(taskId);
  });
});

describe("unified daily entry", () => {
  async function setupProject(cookie: string, code: string, name: string) {
    await createProject(cookie, code, name);
    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (
      listResponse as { projects: { id: string; code: string }[] }
    ).projects.find((candidate) => candidate.code === code)!;
    await assignAdminToProject(cookie, project.id);

    return project;
  }

  function loadDetail(cookie: string, workDate: string) {
    return (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/work-logs/${workDate}`, {
        headers: { Cookie: cookie },
      }),
      params: { date: workDate },
      context: buildContext(),
    });
  }

  test("saves total working hours and multiple allocations in one submission", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const first = await setupProject(cookie, "UNI-1", "First project");
    const second = await setupProject(cookie, "UNI-2", "Second project");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(
          buildSaveDayForm({
            totalWorkingHours: 8,
            rows: [
              { projectId: first.id, allocatedHours: 4 },
              { projectId: second.id, allocatedHours: 4 },
            ],
          }),
          cookie,
        ),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );

    expect((response as { success: string }).success).toContain("2 件");

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { id: string; totalWorkingHours: number } | null;
      allocations: { projectId: string; allocatedHours: number }[];
    };
    expect(detail.workLog?.totalWorkingHours).toBe(8);
    expect(detail.allocations).toHaveLength(2);
    expect(
      detail.allocations.map((allocation) => allocation.allocatedHours).sort(),
    ).toEqual([4, 4]);
  });

  test("creates the work log without a prior total-hours save", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "UNI-3", "Third project");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(
          buildSaveDayForm({
            totalWorkingHours: 7.5,
            rows: [{ projectId: project.id, allocatedHours: 7.5 }],
          }),
          cookie,
        ),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );

    expect((response as { error?: string }).error).toBeUndefined();

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { totalWorkingHours: number } | null;
    };
    expect(detail.workLog?.totalWorkingHours).toBe(7.5);
  });

  test("ignores blank rows without reporting an error", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "UNI-4", "Fourth project");

    const formData = buildSaveDayForm({
      totalWorkingHours: 8,
      rows: [{ projectId: project.id, allocatedHours: 8 }],
    });
    formData.append("allocationId", "");
    formData.append("projectId", "");
    formData.append("taskId", "");
    formData.append("allocatedHours", "");
    formData.append("note", "");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(formData, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );

    expect((response as { error?: string }).error).toBeUndefined();
    expect((response as { success: string }).success).toContain("1 件");

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      allocations: unknown[];
    };
    expect(detail.allocations).toHaveLength(1);
  });

  test("rejects the whole submission when one row is invalid", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "UNI-5", "Fifth project");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(
          buildSaveDayForm({
            totalWorkingHours: 8,
            rows: [
              { projectId: project.id, allocatedHours: 4 },
              { projectId: project.id, allocatedHours: 0.1 },
            ],
          }),
          cookie,
        ),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );

    expect((response as { error: string }).error).toContain("0.25h");
    expect(
      (response as { draft: { rows: { allocatedHours: string }[] } }).draft
        .rows,
    ).toMatchObject([{ allocatedHours: "4" }, { allocatedHours: "0.1" }]);

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      allocations: unknown[];
    };
    expect(detail.allocations).toHaveLength(0);
  });

  test("updates retained rows and removes omitted rows in one submission", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const first = await setupProject(cookie, "UNI-8", "Eighth project");
    const second = await setupProject(cookie, "UNI-9", "Ninth project");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [
            { projectId: first.id, allocatedHours: 4 },
            { projectId: second.id, allocatedHours: 4 },
          ],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const before = (await loadDetail(cookie, "2026-07-15")) as {
      allocations: { id: string; projectId: string }[];
    };
    const retained = before.allocations.find(
      (allocation) => allocation.projectId === first.id,
    )!;

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 9.5,
          rows: [
            {
              allocationId: retained.id,
              projectId: first.id,
              allocatedHours: 9.5,
            },
          ],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const after = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { totalWorkingHours: number };
      allocations: { id: string; allocatedHours: number }[];
    };
    expect(after.workLog.totalWorkingHours).toBe(9.5);
    expect(after.allocations).toEqual([
      expect.objectContaining({ id: retained.id, allocatedHours: 9.5 }),
    ]);
  });

  test("rejects a row whose allocation belongs to another date", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "UNI-6", "Sixth project");

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 4 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      allocations: { id: string }[];
    };
    const allocationId = detail.allocations[0].id;

    const invalid = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ allocationId, projectId: project.id, allocatedHours: 4 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-16" },
      context: buildContext(),
    });
    expect((invalid as { error: string }).error).toContain(
      "対象の実績工数が見つかりません",
    );
    expect((invalid as { draft: unknown }).draft).toBeDefined();

    const unchanged = (await loadDetail(cookie, "2026-07-15")) as {
      allocations: { allocatedHours: number }[];
    };
    expect(unchanged.allocations[0].allocatedHours).toBe(4);
  });

  test("removes a single row through the delete control", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "UNI-7", "Seventh project");

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 4 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      allocations: { id: string }[];
    };
    const allocationId = detail.allocations[0].id;

    const deleteForm = new FormData();
    deleteForm.append("deleteAllocationId", allocationId);

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(deleteForm, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect((response as { success: string }).success).toContain("削除");

    const after = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { totalWorkingHours: number } | null;
      allocations: unknown[];
    };
    expect(after.allocations).toHaveLength(0);
    expect(after.workLog?.totalWorkingHours).toBe(8);
  });

  test("saves only total working hours without touching allocations", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "TOT-1", "Total only project");

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 4 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const form = new FormData();
    form.append("intent", "saveWorkLog");
    form.append("totalWorkingHours", "7.5");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(form, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect((response as { success: string }).success).toContain("総稼働時間");

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { id: string; totalWorkingHours: number } | null;
      allocations: unknown[];
    };
    expect(detail.workLog?.totalWorkingHours).toBe(7.5);
    expect(detail.allocations).toHaveLength(1);
  });

  test("creates the work log from a total-only save", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const form = new FormData();
    form.append("intent", "saveWorkLog");
    form.append("totalWorkingHours", "6");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(form, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect((response as { error?: string }).error).toBeUndefined();

    const detail = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { id: string; totalWorkingHours: number } | null;
      allocations: unknown[];
    };
    expect(detail.workLog?.totalWorkingHours).toBe(6);
    expect(detail.allocations).toHaveLength(0);

    const connection = createDatabaseConnection();
    deleteDailyWorkLog(
      connection.db,
      detail.workLog!.id,
      "2026-07-16T00:00:00.000Z",
    );
    connection.sqlite.close();

    form.set("totalWorkingHours", "7");
    const restoredResponse = await (
      workLogDateAction as unknown as RouteActionHandler
    )({
      request: buildRequest(form, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((restoredResponse as { error?: string }).error).toBeUndefined();
    const restored = (await loadDetail(cookie, "2026-07-15")) as {
      workLog: { id: string; totalWorkingHours: number } | null;
    };
    expect(restored.workLog).toMatchObject({
      id: detail.workLog!.id,
      totalWorkingHours: 7,
    });
  });

  test("rejects an invalid total in the total-only save", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const form = new FormData();
    form.append("intent", "saveWorkLog");
    form.append("totalWorkingHours", "8.13");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(form, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect((response as { error: string }).error).toContain("0.25h");

    form.set("totalWorkingHours", "24.25");
    const overDay = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(form, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((overDay as { error: string }).error).toContain("24h 以下");
  });

  test("total-only save is refused for a protected month", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const lockForm = new FormData();
    lockForm.append("intent", "startReview");
    lockForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const form = new FormData();
    form.append("intent", "saveWorkLog");
    form.append("totalWorkingHours", "8");

    await expect(
      (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(form, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });
});

describe("copy previous day effort", () => {
  async function setupProject(cookie: string, code: string, name: string) {
    await createProject(cookie, code, name);
    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (
      listResponse as { projects: { id: string; code: string }[] }
    ).projects.find((candidate) => candidate.code === code)!;
    await assignAdminToProject(cookie, project.id);

    return project;
  }

  function copyForm() {
    const formData = new FormData();
    formData.append("intent", "copyPrevious");

    return formData;
  }

  function loadDetail(cookie: string, workDate: string) {
    return (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/work-logs/${workDate}`, {
        headers: { Cookie: cookie },
      }),
      params: { date: workDate },
      context: buildContext(),
    });
  }

  test("copies the previous day's allocations into an empty day", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "CPY-1", "Copy source");

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: project.id, allocatedHours: 6, note: "Note" }],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(copyForm(), cookie),
        params: { date: "2026-07-16" },
        context: buildContext(),
      },
    );

    expect((response as { success: string }).success).toContain("1 件");

    const detail = (await loadDetail(cookie, "2026-07-16")) as {
      workLog: { totalWorkingHours: number } | null;
      allocations: {
        projectId: string;
        allocatedHours: number;
        note: string | null;
      }[];
    };
    expect(detail.workLog?.totalWorkingHours).toBe(8);
    expect(detail.allocations).toHaveLength(1);
    expect(detail.allocations[0]).toMatchObject({
      projectId: project.id,
      allocatedHours: 6,
      note: "Note",
    });
  });

  test("refuses to copy when the day already has allocations", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const project = await setupProject(cookie, "CPY-2", "Copy target");

    for (const date of ["2026-07-15", "2026-07-16"]) {
      await (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(
          buildSaveDayForm({
            totalWorkingHours: 8,
            rows: [{ projectId: project.id, allocatedHours: 4 }],
          }),
          cookie,
        ),
        params: { date },
        context: buildContext(),
      });
    }

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(copyForm(), cookie),
        params: { date: "2026-07-16" },
        context: buildContext(),
      },
    );

    expect((response as { error: string }).error).toContain("既に実績工数");
  });

  test("reports when the previous day has nothing to copy", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(copyForm(), cookie),
        params: { date: "2026-07-16" },
        context: buildContext(),
      },
    );

    expect((response as { error: string }).error).toContain(
      "複製する内容がありません",
    );
  });

  test("skips rows whose project is archived and reports the skipped name", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const keep = await setupProject(cookie, "CPY-3", "Keep project");
    const archived = await setupProject(cookie, "CPY-4", "Archived project");

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [
            { projectId: keep.id, allocatedHours: 4 },
            { projectId: archived.id, allocatedHours: 4 },
          ],
        }),
        cookie,
      ),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const connection = createDatabaseConnection();
    try {
      archiveProject(connection.db, archived.id, new Date().toISOString());
    } finally {
      connection.sqlite.close();
    }

    const response = await (workLogDateAction as unknown as RouteActionHandler)(
      {
        request: buildRequest(copyForm(), cookie),
        params: { date: "2026-07-16" },
        context: buildContext(),
      },
    );

    const result = response as { success?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.success).toContain("1 件");
    expect(result.success).toContain("Archived project");

    const detail = (await loadDetail(cookie, "2026-07-16")) as {
      allocations: { projectId: string }[];
    };
    expect(detail.allocations).toHaveLength(1);
    expect(detail.allocations[0].projectId).toBe(keep.id);
  });
});

describe("recently used project ordering", () => {
  test("orders projects the member used most recently first", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    await createProject(cookie, "ORD-1", "Older project");
    await createProject(cookie, "ORD-2", "Newer project");
    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const projects = (
      listResponse as { projects: { id: string; code: string }[] }
    ).projects;
    const older = projects.find((candidate) => candidate.code === "ORD-1")!;
    const newer = projects.find((candidate) => candidate.code === "ORD-2")!;

    await assignAdminToProject(cookie, older.id);
    await assignAdminToProject(cookie, newer.id);

    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: older.id, allocatedHours: 8 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-10" },
      context: buildContext(),
    });
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(
        buildSaveDayForm({
          totalWorkingHours: 8,
          rows: [{ projectId: newer.id, allocatedHours: 8 }],
        }),
        cookie,
      ),
      params: { date: "2026-07-20" },
      context: buildContext(),
    });

    const detail = await (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/2026-07-21", {
        headers: { Cookie: cookie },
      }),
      params: { date: "2026-07-21" },
      context: buildContext(),
    });

    const ids = (
      detail as { assignedProjects: { id: string }[] }
    ).assignedProjects.map((project) => project.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });
});

describe("weekly entry and member effort context", () => {
  async function setupAssignedProject(cookie: string) {
    const form = new FormData();
    form.append("code", "WEEK-1");
    form.append("name", "Weekly project");
    form.append("projectType", "billable");
    form.append("contractRevenueAmount", "1000000");
    form.append("laborCostBudgetAmount", "600000");
    form.append("effortBudgetHours", "120");
    await (newProjectAction as unknown as RouteActionHandler)({
      request: buildRequest(form, cookie),
      params: {},
      context: buildContext(),
    });
    const response = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (
      response as { projects: { id: string; code: string }[] }
    ).projects.find((item) => item.code === "WEEK-1")!;
    const member = await assignAdminToProject(cookie, project.id);
    return { project, member };
  }

  test("loads and atomically saves a representative week", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const { project } = await setupAssignedProject(cookie);
    const loaded = await (workLogWeekLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/week?date=2026-07-08", {
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    const data = loaded as {
      draft: { weekDate: string; dates: string[] };
      projects: { id: string }[];
    };
    expect(data.draft.weekDate).toBe("2026-07-06");
    expect(data.draft.dates).toHaveLength(7);
    expect(data.projects.map((item) => item.id)).toContain(project.id);

    const weeklyDraft = {
      weekDate: data.draft.weekDate,
      dates: data.draft.dates,
      totalWorkingHours: {
        "2026-07-06": "8",
        "2026-07-07": "9.5",
      },
      rows: [
        {
          key: "row-1",
          projectId: project.id,
          taskId: "",
          note: "",
          allocationIds: {},
          hours: { "2026-07-06": "8", "2026-07-07": "9.5" },
        },
      ],
    };
    const form = new FormData();
    form.append("weeklyDraft", JSON.stringify(weeklyDraft));
    const saved = await (workLogWeekAction as unknown as RouteActionHandler)({
      request: buildRequest(form, cookie),
      params: {},
      context: buildContext(),
    });
    expect((saved as { success: string }).success).toContain("2日分");

    weeklyDraft.rows[0].hours["2026-07-07"] = "1.1";
    const invalidForm = new FormData();
    invalidForm.append("weeklyDraft", JSON.stringify(weeklyDraft));
    const invalid = await (workLogWeekAction as unknown as RouteActionHandler)({
      request: buildRequest(invalidForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect((invalid as { error: string }).error).toContain("2026-07-07");
    expect((invalid as { draft: unknown }).draft).toEqual(weeklyDraft);
  });

  test("member daily loader exposes own hour progress without financial fields", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const { project, member } = await setupAssignedProject(cookie);
    const connection = createDatabaseConnection();
    createMonthlyPlan(connection.db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 40,
      hourlyCostRateSnapshot: 5000,
    });
    connection.db
      .update(members)
      .set({ role: "member", hourlyCostRate: 5000 })
      .where(eq(members.id, member.id))
      .run();
    connection.sqlite.close();

    const response = await (workLogDateLoader as unknown as RouteLoaderHandler)(
      {
        request: new Request("http://localhost/work-logs/2026-07-15", {
          headers: { Cookie: cookie },
        }),
        params: { date: "2026-07-15" },
        context: buildContext(),
      },
    );
    expect(
      (
        response as {
          projectEffortContext: Record<
            string,
            { plannedHours: number; actualHours: number; balanceHours: number }
          >;
        }
      ).projectEffortContext[project.id],
    ).toEqual({ plannedHours: 40, actualHours: 0, balanceHours: 40 });
    const payload = JSON.stringify(response);
    expect(payload).not.toContain("hourlyCostRate");
    expect(payload).not.toContain("contractRevenueAmount");
    expect(payload).not.toContain("laborCostBudgetAmount");
  });
});
