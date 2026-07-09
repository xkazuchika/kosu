// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { listDailyAllocationPlansByMemberAndDate } from "../../app/db/repositories/daily-allocation-plans";
import { findDailyWorkLogByMemberAndDate } from "../../app/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import { createMonthlyPlan, listMonthlyPlansByMemberAndMonth } from "../../app/db/repositories/monthly-plans";
import { createPeriodLock } from "../../app/db/repositories/period-locks";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import { createProject } from "../../app/db/repositories/projects";
import { members } from "../../app/db/schema";
import { action as dailyPlansAction, loader as dailyPlansLoader } from "../../app/routes/daily-plans";
import { buildContext, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-daily-plans-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

function buildPostRequest(url: string, formData: FormData, cookie: string) {
  return new Request(url, { method: "POST", body: formData, headers: { Cookie: cookie } });
}

function setupProjectForAdmin() {
  const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
  const admin = connection.db.select().from(members).where(eq(members.email, "admin@example.com")).get()!;
  const project = createProject(connection.db, { code: "PRJ-001", name: "Website", projectType: "billable" });
  createProjectAssignment(connection.db, { memberId: admin.id, projectId: project.id });
  connection.sqlite.close();
  return { admin, project };
}

describe("daily plans route", () => {
  test("loader exposes target month, assigned projects, and monthly comparison", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const { admin, project } = setupProjectForAdmin();
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createMonthlyPlan(connection.db, { memberId: admin.id, projectId: project.id, month: "2026-07", plannedHours: 20 });
    connection.sqlite.close();

    const response = await (dailyPlansLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/daily-plans?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });

    expect((response as { month: string }).month).toBe("2026-07");
    expect((response as { assignedProjects: { id: string }[] }).assignedProjects[0].id).toBe(project.id);
    expect((response as { monthlyTotal: number }).monthlyTotal).toBe(20);
  });

  test("member saves own daily plan and zero deletes it", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");
    const { admin: member, project } = setupProjectForAdmin();

    const saveForm = new FormData();
    saveForm.append("month", "2026-07");
    saveForm.append("planDate", "2026-07-01");
    saveForm.append("projectId", project.id);
    saveForm.append("plannedHours", "4");

    await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest("http://localhost/daily-plans?month=2026-07", saveForm, cookie),
      params: {},
      context: buildContext(),
    });

    let connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    expect(listDailyAllocationPlansByMemberAndDate(connection.db, member.id, "2026-07-01")[0].plannedHours).toBe(4);
    connection.sqlite.close();

    const deleteForm = new FormData();
    deleteForm.append("month", "2026-07");
    deleteForm.append("planDate", "2026-07-01");
    deleteForm.append("projectId", project.id);
    deleteForm.append("plannedHours", "0");
    await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest("http://localhost/daily-plans?month=2026-07", deleteForm, cookie),
      params: {},
      context: buildContext(),
    });

    connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    expect(listDailyAllocationPlansByMemberAndDate(connection.db, member.id, "2026-07-01")).toHaveLength(0);
    connection.sqlite.close();
  });

  test("administrator saves selected member daily plan", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const targetMember = createMember(connection.db, { displayName: "Hanako", email: "hanako@example.com", passwordHash: "hash" });
    const project = createProject(connection.db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    createProjectAssignment(connection.db, { memberId: targetMember.id, projectId: project.id });
    connection.sqlite.close();

    const form = new FormData();
    form.append("month", "2026-07");
    form.append("memberId", targetMember.id);
    form.append("planDate", "2026-07-01");
    form.append("projectId", project.id);
    form.append("plannedHours", "3");
    await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest(`http://localhost/daily-plans?month=2026-07&memberId=${targetMember.id}`, form, cookie),
      params: {},
      context: buildContext(),
    });

    const verify = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    expect(listDailyAllocationPlansByMemberAndDate(verify.db, targetMember.id, "2026-07-01")[0].plannedHours).toBe(3);
    verify.sqlite.close();
  });

  test("non-administrator cannot edit another member daily plan", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const otherMember = createMember(connection.db, { displayName: "Hanako", email: "hanako@example.com", passwordHash: "hash" });
    const project = createProject(connection.db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    createProjectAssignment(connection.db, { memberId: otherMember.id, projectId: project.id });
    connection.sqlite.close();

    const form = new FormData();
    form.append("month", "2026-07");
    form.append("memberId", otherMember.id);
    form.append("planDate", "2026-07-01");
    form.append("projectId", project.id);
    form.append("plannedHours", "3");
    const response = await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest(`http://localhost/daily-plans?month=2026-07&memberId=${otherMember.id}`, form, cookie),
      params: {},
      context: buildContext(),
    });

    expect(response as { error: string }).toHaveProperty("error");
    const verify = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    expect(listDailyAllocationPlansByMemberAndDate(verify.db, otherMember.id, "2026-07-01")).toHaveLength(0);
    verify.sqlite.close();
  });

  test("route rejects unassigned project and locked month", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const admin = connection.db.select().from(members).where(eq(members.email, "admin@example.com")).get()!;
    const project = createProject(connection.db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    connection.sqlite.close();

    const form = new FormData();
    form.append("month", "2026-07");
    form.append("planDate", "2026-07-01");
    form.append("projectId", project.id);
    form.append("plannedHours", "3");
    const unassignedResponse = await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest("http://localhost/daily-plans?month=2026-07", form, cookie),
      params: {},
      context: buildContext(),
    });
    expect(unassignedResponse as { error: string }).toHaveProperty("error");

    const lockConnection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createProjectAssignment(lockConnection.db, { memberId: admin.id, projectId: project.id });
    createPeriodLock(lockConnection.db, { month: "2026-07", isLocked: true });
    lockConnection.sqlite.close();

    await expect(
      (dailyPlansAction as unknown as RouteActionHandler)({
        request: buildPostRequest("http://localhost/daily-plans?month=2026-07", form, cookie),
        params: {},
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  test("copy action creates actual work log and allocations", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const { admin, project } = setupProjectForAdmin();
    const saveForm = new FormData();
    saveForm.append("month", "2026-07");
    saveForm.append("planDate", "2026-07-01");
    saveForm.append("projectId", project.id);
    saveForm.append("plannedHours", "4");
    await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest("http://localhost/daily-plans?month=2026-07", saveForm, cookie),
      params: {},
      context: buildContext(),
    });

    const copyForm = new FormData();
    copyForm.append("intent", "copy");
    copyForm.append("month", "2026-07");
    const response = await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest("http://localhost/daily-plans?month=2026-07", copyForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect((response as { copySummary: { copiedDates: number; createdAllocations: number } }).copySummary).toMatchObject({ copiedDates: 1, createdAllocations: 1 });

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const workLog = findDailyWorkLogByMemberAndDate(connection.db, admin.id, "2026-07-01")!;
    expect(workLog.totalWorkingHours).toBe(4);
    expect(listAllocationsByWorkLog(connection.db, workLog.id)[0]).toMatchObject({ projectId: project.id, allocatedHours: 4, taskId: null });
    connection.sqlite.close();
  });

  test("saving daily plans does not rewrite monthly plans", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const { admin, project } = setupProjectForAdmin();
    let connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    createMonthlyPlan(connection.db, { memberId: admin.id, projectId: project.id, month: "2026-07", plannedHours: 10 });
    connection.sqlite.close();

    const form = new FormData();
    form.append("month", "2026-07");
    form.append("planDate", "2026-07-01");
    form.append("projectId", project.id);
    form.append("plannedHours", "4");
    await (dailyPlansAction as unknown as RouteActionHandler)({
      request: buildPostRequest("http://localhost/daily-plans?month=2026-07", form, cookie),
      params: {},
      context: buildContext(),
    });

    connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    expect(listMonthlyPlansByMemberAndMonth(connection.db, admin.id, "2026-07")[0]).toMatchObject({ plannedHours: 10 });
    connection.sqlite.close();
  });
});
