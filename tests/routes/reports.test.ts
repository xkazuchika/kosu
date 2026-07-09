// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { upsertDailyAllocationPlan } from "../../app/db/repositories/daily-allocation-plans";
import { createMemberMonthlyCapacity } from "../../app/db/repositories/member-monthly-capacities";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { members } from "../../app/db/schema";
import { action as projectAssignmentsAction, loader as projectAssignmentsLoader } from "../../app/routes/projects.$id.assignments";
import { action as newProjectAction } from "../../app/routes/projects.new";
import { loader as projectsLoader } from "../../app/routes/projects";
import { action as reportsAction, loader as reportsLoader } from "../../app/routes/reports";
import { loader as plannedVsActualLoader } from "../../app/routes/reports.planned-vs-actual";
import { action as workLogDateAction } from "../../app/routes/work-logs.$date";
import { copyDailyAllocationPlansToActuals } from "../../app/services/daily-allocation-plans";
import { buildContext, buildRequest, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-reports-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

async function createProject(cookie: string, code: string, name: string, type = "internal") {
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
  const assignmentsResponse = await (projectAssignmentsLoader as unknown as RouteLoaderHandler)({
    request: new Request(`http://localhost/projects/${projectId}/assignments`, { headers: { Cookie: cookie } }),
    params: { id: projectId },
    context: buildContext(),
  });
  const adminMember = (assignmentsResponse as { members: { id: string }[] }).members[0];

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

async function createWorkLogAndAllocation(cookie: string, projectId: string, date: string) {
  const workLogForm = new FormData();
  workLogForm.append("intent", "saveWorkLog");
  workLogForm.append("totalWorkingHours", "8");
  await (workLogDateAction as unknown as RouteActionHandler)({
    request: buildRequest(workLogForm, cookie),
    params: { date },
    context: buildContext(),
  });

  const allocationForm = new FormData();
  allocationForm.append("intent", "addAllocation");
  allocationForm.append("projectId", projectId);
  allocationForm.append("allocatedHours", "6");

  await (workLogDateAction as unknown as RouteActionHandler)({
    request: buildRequest(allocationForm, cookie),
    params: { date },
    context: buildContext(),
  });
}

describe("reports", () => {
  test("admin effort report shows allocation rows", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);
    await createWorkLogAndAllocation(cookie, project.id, "2026-07-15");

    const response = await (reportsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const rows = (response as { rows: { allocatedHours: number }[] }).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].allocatedHours).toBe(6);
  });

  test("admin csv export uses v0.1 effort columns without financial columns", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const response = await (reportsAction as unknown as RouteActionHandler)({
      request: new Request("http://localhost/reports?month=2026-07", {
        method: "POST",
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).text();
    expect(body).toContain("日付");
    expect(body).toContain("時間");
    expect(body).not.toContain("原価率");
    expect(body).not.toContain("原価");
    expect((response as Response).headers.get("Content-Disposition")).toContain("kosu-effort-report-2026-07.csv");
  });

  test("member csv export excludes financial columns", async () => {
    const memberCookie = await setupAndLogin(dataDir, "password123", "member");

    const response = await (reportsAction as unknown as RouteActionHandler)({
      request: new Request("http://localhost/reports?month=2026-07", {
        method: "POST",
        headers: { Cookie: memberCookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).text();
    expect(body).not.toContain("原価率");
    expect(body).not.toContain("原価");
  });

  test("effort report loader strips cost-rate snapshots from report payload", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    connection.db.update(members).set({ hourlyCostRate: 5000 }).where(eq(members.email, "admin@example.com")).run();
    connection.sqlite.close();

    await createProject(cookie, "PRJ-001", "Website", "internal");
    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);
    await createWorkLogAndAllocation(cookie, project.id, "2026-07-15");

    const response = await (reportsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const rows = (response as { rows: { hourlyCostRateSnapshot: number | null }[]; isAdmin: boolean }).rows;
    expect((response as { isAdmin: boolean }).isAdmin).toBe(true);
    expect(rows[0].hourlyCostRateSnapshot).toBeNull();
  });

  test("planned-versus-actual report compares plans, actuals, and capacity", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");
    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    const adminMember = await assignAdminToProject(cookie, project.id);
    await createWorkLogAndAllocation(cookie, project.id, "2026-07-15");

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createMemberMonthlyCapacity(connection.db, { memberId: adminMember.id, month: "2026-07", capacityHours: 160 });
    createMonthlyPlan(connection.db, {
      memberId: adminMember.id,
      projectId: project.id,
      month: "2026-07",
      assignmentRole: "Engineer",
      plannedHours: 10,
    });
    connection.sqlite.close();

    const response = await (plannedVsActualLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports/planned-vs-actual?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const rows = (response as { rows: { plannedHours: number; actualHours: number; variance: number }[] }).rows;
    expect(rows[0].plannedHours).toBe(10);
    expect(rows[0].actualHours).toBe(6);
    expect(rows[0].variance).toBe(-4);
    const capacityRows = (response as { capacityRows: { capacityHours: number; totalPlanned: number; totalActual: number; unallocatedCapacity: number; overplannedHours: number }[] }).capacityRows;
    expect(capacityRows[0]).toMatchObject({
      capacityHours: 160,
      totalPlanned: 10,
      totalActual: 6,
      unallocatedCapacity: 150,
      overplannedHours: 0,
    });
  });

  test("planned-versus-actual report exposes missing-plan guidance state", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const adminMember = connection.db.select().from(members).where(eq(members.email, "admin@example.com")).get()!;
    createMemberMonthlyCapacity(connection.db, { memberId: adminMember.id, month: "2026-07", capacityHours: 160 });
    connection.sqlite.close();

    const response = await (plannedVsActualLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports/planned-vs-actual?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    expect((response as { hasPlans: boolean; planningState: string }).hasPlans).toBe(false);
    expect((response as { hasPlans: boolean; planningState: string }).planningState).toBe("missing-plans");
  });

  test("planned-versus-actual report works without capacity", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");
    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    const adminMember = await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createMonthlyPlan(connection.db, {
      memberId: adminMember.id,
      projectId: project.id,
      month: "2026-07",
      assignmentRole: "Engineer",
      plannedHours: 10,
    });
    connection.sqlite.close();

    const response = await (plannedVsActualLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports/planned-vs-actual?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    expect((response as { hasPlans: boolean; planningState: string }).hasPlans).toBe(true);
    expect((response as { hasPlans: boolean; planningState: string }).planningState).toBe("ready");
    const rows = (response as { rows: { plannedHours: number; actualHours: number; variance: number }[] }).rows;
    expect(rows[0]).toMatchObject({ plannedHours: 10, actualHours: 0, variance: -10 });
    const capacityRows = (response as { capacityRows: { capacityHours: number | null; overplannedHours: number | null }[] }).capacityRows;
    expect(capacityRows[0]).toMatchObject({ capacityHours: null, overplannedHours: null });
  });

  test("planned-versus-actual remains monthly-plan based when daily plans exist", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");
    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    const adminMember = await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createMonthlyPlan(connection.db, {
      memberId: adminMember.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 10,
    });
    upsertDailyAllocationPlan(connection.db, {
      memberId: adminMember.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    connection.sqlite.close();

    const response = await (plannedVsActualLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports/planned-vs-actual?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const rows = (response as { rows: { plannedHours: number; actualHours: number; variance: number }[] }).rows;
    expect(rows[0]).toMatchObject({ plannedHours: 10, actualHours: 0, variance: -10 });
  });

  test("actuals copied from daily plans appear as actual effort in planned-versus-actual", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");
    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    const adminMember = await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createMonthlyPlan(connection.db, {
      memberId: adminMember.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 10,
    });
    upsertDailyAllocationPlan(connection.db, {
      memberId: adminMember.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    copyDailyAllocationPlansToActuals(connection.db, { memberId: adminMember.id, month: "2026-07" });
    connection.sqlite.close();

    const response = await (plannedVsActualLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports/planned-vs-actual?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const rows = (response as { rows: { plannedHours: number; actualHours: number; variance: number }[] }).rows;
    expect(rows[0]).toMatchObject({ plannedHours: 10, actualHours: 4, variance: -6 });
  });
});
