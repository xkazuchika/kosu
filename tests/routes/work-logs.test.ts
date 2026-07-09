// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import { createMember } from "../../app/db/repositories/members";
import { archiveProject } from "../../app/db/repositories/projects";
import { archiveTask, createTask } from "../../app/db/repositories/tasks";
import { members } from "../../app/db/schema";
import { action as periodLocksAction } from "../../app/routes/period-locks";
import { action as projectAssignmentsAction, loader as projectAssignmentsLoader } from "../../app/routes/projects.$id.assignments";
import { action as newProjectAction } from "../../app/routes/projects.new";
import { loader as projectsLoader } from "../../app/routes/projects";
import { action as workLogDateAction, loader as workLogDateLoader } from "../../app/routes/work-logs.$date";
import { action as workLogMonthAction, loader as workLogMonthLoader } from "../../app/routes/work-logs.month";
import { loader as workLogsLoader } from "../../app/routes/work-logs";
import { buildContext, buildRequest, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-work-logs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe("daily work logs and allocations", () => {
  test("member bulk edits monthly daily totals", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "8");
    formData.append("date", "2026-07-02");
    formData.append("totalWorkingHours", "7.5");

    const response = await (workLogMonthAction as unknown as RouteActionHandler)({
      request: new Request("http://localhost/work-logs/month?month=2026-07", {
        method: "POST",
        body: formData,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/work-logs/month?month=2026-07");

    const monthResponse = await (workLogMonthLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/month?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const rows = (monthResponse as { rows: { isSaturday: boolean; isSunday: boolean; totalWorkingHours: number; workDate: string }[] }).rows;
    expect(rows).toHaveLength(31);
    expect(rows.find((row) => row.workDate === "2026-07-01")?.totalWorkingHours).toBe(8);
    expect(rows.find((row) => row.workDate === "2026-07-02")?.totalWorkingHours).toBe(7.5);
    expect(rows.find((row) => row.workDate === "2026-07-04")).toMatchObject({ isSaturday: true, isSunday: false });
    expect(rows.find((row) => row.workDate === "2026-07-05")).toMatchObject({ isSaturday: false, isSunday: true });
  });

  test("monthly work log rejects invalid bulk hours", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");
    const formData = new FormData();
    formData.append("date", "2026-07-01");
    formData.append("totalWorkingHours", "8.13");

    const response = await (workLogMonthAction as unknown as RouteActionHandler)({
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

    const response = await (workLogMonthAction as unknown as RouteActionHandler)({
      request: new Request(`http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`, {
        method: "POST",
        body: formData,
        headers: { Cookie: cookie },
      }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(`/work-logs/month?month=2026-07&memberId=${member.id}`);

    const monthResponse = await (workLogMonthLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/work-logs/month?month=2026-07&memberId=${member.id}`, { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    expect((monthResponse as { targetMember: { id: string } }).targetMember.id).toBe(member.id);
    expect((monthResponse as { rows: { totalWorkingHours: number }[] }).rows[0].totalWorkingHours).toBe(6);
  });

  test("locked month prevents member monthly bulk edit", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const lockForm = new FormData();
    lockForm.append("intent", "lock");
    lockForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const connection = createDatabaseConnection();
    connection.db.update(members).set({ role: "member" }).where(eq(members.email, "admin@example.com")).run();
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

    const formData = new FormData();
    formData.append("intent", "saveWorkLog");
    formData.append("totalWorkingHours", "8");

    const actionResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(formData, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect(actionResponse).toBeInstanceOf(Response);
    expect((actionResponse as Response).headers.get("Location")).toBe("/work-logs/2026-07-15");

    const listResponse = await (workLogsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const logs = (listResponse as { logs: { workDate: string; totalWorkingHours: number }[] }).logs;
    expect(logs.some((log) => log.workDate === "2026-07-15" && log.totalWorkingHours === 8)).toBe(true);
  });

  test("work log list redirects date query to daily entry", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    try {
      await (workLogsLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/work-logs?date=2026-07-15", { headers: { Cookie: cookie } }),
        context: buildContext(),
      });
      throw new Error("Expected redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).headers.get("Location")).toBe("/work-logs/2026-07-15");
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
        request: new Request(`http://localhost/work-logs?memberId=${member.id}&date=2026-07-15`, { headers: { Cookie: cookie } }),
        context: buildContext(),
      });
      throw new Error("Expected redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).headers.get("Location")).toBe(`/work-logs/2026-07-15?memberId=${member.id}`);
    }
  });

  test("member adds allocation to assigned project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const allocationForm = new FormData();
    allocationForm.append("intent", "addAllocation");
    allocationForm.append("projectId", project.id);
    allocationForm.append("allocatedHours", "6.25");
    allocationForm.append("note", "Backend");

    const allocationResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(allocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect(allocationResponse).toBeInstanceOf(Response);
    expect((allocationResponse as Response).headers.get("Location")).toBe(`/work-logs/2026-07-15`);

    const detailResponse = await (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/2026-07-15", { headers: { Cookie: cookie } }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((detailResponse as { workLog: { totalWorkingHours: number } | null }).workLog?.totalWorkingHours).toBe(8);
    const allocations = (detailResponse as { allocations: { allocatedHours: number }[] }).allocations;
    const allocatedTotal = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
    expect(allocatedTotal).toBe(6.25);
    expect(8 - allocatedTotal).toBe(1.75);
  });

  test("member updates existing allocation hours and note", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const allocationForm = new FormData();
    allocationForm.append("intent", "addAllocation");
    allocationForm.append("projectId", project.id);
    allocationForm.append("allocatedHours", "4");
    allocationForm.append("note", "Initial");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(allocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const detailResponse = await (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/2026-07-15", { headers: { Cookie: cookie } }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const allocationId = (detailResponse as { allocations: { id: string }[] }).allocations[0].id;

    const updateForm = new FormData();
    updateForm.append("intent", "updateAllocation");
    updateForm.append("allocationId", allocationId);
    updateForm.append("projectId", project.id);
    updateForm.append("allocatedHours", "6.5");
    updateForm.append("note", "Updated");
    const updateResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(updateForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect(updateResponse).toBeInstanceOf(Response);

    const updatedDetailResponse = await (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/2026-07-15", { headers: { Cookie: cookie } }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const updatedAllocation = (updatedDetailResponse as { allocations: { allocatedHours: number; note: string | null }[] }).allocations[0];
    expect(updatedAllocation.allocatedHours).toBe(6.5);
    expect(updatedAllocation.note).toBe("Updated");
  });

  test("rejects non-quarter-hour values", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const formData = new FormData();
    formData.append("intent", "saveWorkLog");
    formData.append("totalWorkingHours", "8.13");

    const response = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(formData, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((response as { error: string }).error).toContain("0.25h");
  });

  test("rejects zero-hour work logs and allocations", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);

    const zeroWorkLogForm = new FormData();
    zeroWorkLogForm.append("intent", "saveWorkLog");
    zeroWorkLogForm.append("totalWorkingHours", "0");

    const zeroWorkLogResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(zeroWorkLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((zeroWorkLogResponse as { error: string }).error).toContain("0.25h");

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const zeroAllocationForm = new FormData();
    zeroAllocationForm.append("intent", "addAllocation");
    zeroAllocationForm.append("projectId", project.id);
    zeroAllocationForm.append("allocatedHours", "0");

    const zeroAllocationResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(zeroAllocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((zeroAllocationResponse as { error: string }).error).toContain("0.25h");
  });

  test("member cannot allocate to unassigned project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const allocationForm = new FormData();
    allocationForm.append("intent", "addAllocation");
    allocationForm.append("projectId", project.id);
    allocationForm.append("allocatedHours", "4");

    const response = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(allocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((response as { error: string }).error).toContain("アサインされていない");
  });

  test("member allocates to an active task on the selected project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection();
    const task = createTask(connection.db, { projectId: project.id, name: "Backend" });
    connection.sqlite.close();

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const allocationForm = new FormData();
    allocationForm.append("intent", "addAllocation");
    allocationForm.append("projectId", project.id);
    allocationForm.append("taskId", task.id);
    allocationForm.append("allocatedHours", "4");

    const allocationResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(allocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect(allocationResponse).toBeInstanceOf(Response);

    const detailResponse = await (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/2026-07-15", { headers: { Cookie: cookie } }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((detailResponse as { allocations: { taskId: string | null }[] }).allocations[0]?.taskId).toBe(task.id);
    expect((detailResponse as { activeTasks: { id: string }[] }).activeTasks.some((activeTask) => activeTask.id === task.id)).toBe(true);
  });

  test("rejects archived projects and invalid task selections", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");
    await createProject(cookie, "PRJ-002", "Mobile", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const projects = (listResponse as { projects: { id: string; code: string }[] }).projects;
    const project = projects.find((item) => item.code === "PRJ-001")!;
    const otherProject = projects.find((item) => item.code === "PRJ-002")!;
    await assignAdminToProject(cookie, project.id);

    const connection = createDatabaseConnection();
    const task = createTask(connection.db, { projectId: project.id, name: "Backend" });
    const otherTask = createTask(connection.db, { projectId: otherProject.id, name: "Mobile" });
    archiveTask(connection.db, task.id, "2026-07-01T00:00:00Z");
    connection.sqlite.close();

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const archivedTaskForm = new FormData();
    archivedTaskForm.append("intent", "addAllocation");
    archivedTaskForm.append("projectId", project.id);
    archivedTaskForm.append("taskId", task.id);
    archivedTaskForm.append("allocatedHours", "4");

    const archivedTaskResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(archivedTaskForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((archivedTaskResponse as { error: string }).error).toContain("タスク");

    const mismatchedTaskForm = new FormData();
    mismatchedTaskForm.append("intent", "addAllocation");
    mismatchedTaskForm.append("projectId", project.id);
    mismatchedTaskForm.append("taskId", otherTask.id);
    mismatchedTaskForm.append("allocatedHours", "4");

    const mismatchedTaskResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(mismatchedTaskForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((mismatchedTaskResponse as { error: string }).error).toContain("タスク");

    const archiveConnection = createDatabaseConnection();
    archiveProject(archiveConnection.db, project.id, "2026-07-01T00:00:00Z");
    archiveConnection.sqlite.close();

    const archivedProjectForm = new FormData();
    archivedProjectForm.append("intent", "addAllocation");
    archivedProjectForm.append("projectId", project.id);
    archivedProjectForm.append("allocatedHours", "4");

    const archivedProjectResponse = await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(archivedProjectForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    expect((archivedProjectResponse as { error: string }).error).toContain("有効な案件");
  });

  test("locked month prevents work log edit", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const lockForm = new FormData();
    lockForm.append("intent", "lock");
    lockForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const formData = new FormData();
    formData.append("intent", "saveWorkLog");
    formData.append("totalWorkingHours", "8");

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

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];
    await assignAdminToProject(cookie, project.id);

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveWorkLog");
    workLogForm.append("totalWorkingHours", "8");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(workLogForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const allocationForm = new FormData();
    allocationForm.append("intent", "addAllocation");
    allocationForm.append("projectId", project.id);
    allocationForm.append("allocatedHours", "4");
    await (workLogDateAction as unknown as RouteActionHandler)({
      request: buildRequest(allocationForm, cookie),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });

    const detailResponse = await (workLogDateLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/work-logs/2026-07-15", { headers: { Cookie: cookie } }),
      params: { date: "2026-07-15" },
      context: buildContext(),
    });
    const allocationId = (detailResponse as { allocations: { id: string }[] }).allocations[0].id;

    const deleteForm = new FormData();
    deleteForm.append("intent", "deleteAllocation");
    deleteForm.append("allocationId", allocationId);

    await expect(
      (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(deleteForm, cookie),
        params: { date: "2026-07-16" },
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });
});
