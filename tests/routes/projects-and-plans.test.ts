// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, test } from "vitest";

import { loader as projectsLoader } from "../../app/routes/projects";
import { action as newProjectAction } from "../../app/routes/projects.new";
import { action as projectDetailAction } from "../../app/routes/projects.$id";
import { action as projectTasksAction, loader as projectTasksLoader } from "../../app/routes/projects.$id.tasks";
import { action as projectAssignmentsAction, loader as projectAssignmentsLoader } from "../../app/routes/projects.$id.assignments";
import { action as selfAssignAction, loader as selfAssignLoader } from "../../app/routes/self-assign";
import { loader as monthlyPlansLoader } from "../../app/routes/monthly-plans";
import { action as monthlyPlansAdminAction, loader as monthlyPlansAdminLoader } from "../../app/routes/monthly-plans.admin";
import { buildContext, buildRequest, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-projects-plans-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe("projects, tasks, assignments, and plans routes", () => {
  test("admin creates and archives a project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const createResponse = await createProject(cookie, "PRJ-001", "Website", "billable");
    expect(createResponse).toBeInstanceOf(Response);
    expect((createResponse as Response).headers.get("Location")).toBe("/projects");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const listData = listResponse as { projects: { id: string; code: string }[] };
    expect(listData.projects.some((p) => p.code === "PRJ-001")).toBe(true);

    const project = listData.projects.find((p) => p.code === "PRJ-001")!;
    const archiveForm = new FormData();
    archiveForm.append("intent", "archive");

    const archiveResponse = await (projectDetailAction as unknown as RouteActionHandler)({
      request: buildRequest(archiveForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });
    expect(archiveResponse).toBeInstanceOf(Response);
    expect((archiveResponse as Response).headers.get("Location")).toBe("/projects");
  });

  test("admin creates a task under a project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];

    const taskForm = new FormData();
    taskForm.append("name", "Design");

    await (projectTasksAction as unknown as RouteActionHandler)({
      request: buildRequest(taskForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });

    const tasksResponse = await (projectTasksLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/projects/${project.id}/tasks`, { headers: { Cookie: cookie } }),
      params: { id: project.id },
      context: buildContext(),
    });
    expect((tasksResponse as { tasks: { name: string }[] }).tasks.some((t) => t.name === "Design")).toBe(true);
  });

  test("admin assigns member to project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "PRJ-001", "Website", "internal");

    const listResponse = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const project = (listResponse as { projects: { id: string }[] }).projects[0];

    const assignmentsResponse = await (projectAssignmentsLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/projects/${project.id}/assignments`, { headers: { Cookie: cookie } }),
      params: { id: project.id },
      context: buildContext(),
    });
    const adminMember = (assignmentsResponse as { members: { id: string }[] }).members[0];

    const assignForm = new FormData();
    assignForm.append("memberId", adminMember.id);
    assignForm.append("assignmentRole", "Engineer");

    await (projectAssignmentsAction as unknown as RouteActionHandler)({
      request: buildRequest(assignForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });

    const updatedAssignments = await (projectAssignmentsLoader as unknown as RouteLoaderHandler)({
      request: new Request(`http://localhost/projects/${project.id}/assignments`, { headers: { Cookie: cookie } }),
      params: { id: project.id },
      context: buildContext(),
    });
    expect((updatedAssignments as { assignments: { assignmentRole: string }[] }).assignments[0].assignmentRole).toBe("Engineer");
  });

  test("member self-assigns to existing active project", async () => {
    const adminCookie = await setupAndLogin(dataDir, "password123");
    await createProject(adminCookie, "PRJ-001", "Website", "internal");

    const memberCookie = await setupAndLogin(dataDir, "password123", "member");

    const selfAssignResponse = await (selfAssignLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/self-assign", { headers: { Cookie: memberCookie } }),
      context: buildContext(),
    });
    const availableProjects = (selfAssignResponse as { availableProjects: { id: string }[] }).availableProjects;
    expect(availableProjects.length).toBeGreaterThan(0);

    const formData = new FormData();
    formData.append("projectId", availableProjects[0].id);

    const actionResponse = await (selfAssignAction as unknown as RouteActionHandler)({
      request: buildRequest(formData, memberCookie),
      params: {},
      context: buildContext(),
    });
    expect(actionResponse).toBeInstanceOf(Response);
    expect((actionResponse as Response).headers.get("Location")).toBe("/projects");
  });

  test("admin manages monthly capacity and plan", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const capacityForm = new FormData();
    capacityForm.append("intent", "capacity");
    capacityForm.append("memberId", "will-be-replaced");
    capacityForm.append("month", "2026-07");
    capacityForm.append("capacityHours", "160");

    const adminLoader = await (monthlyPlansAdminLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/monthly-plans/admin?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const adminMember = (adminLoader as { members: { id: string }[] }).members[0];
    capacityForm.set("memberId", adminMember.id);

    await (monthlyPlansAdminAction as unknown as RouteActionHandler)({
      request: buildRequest(capacityForm, cookie),
      params: {},
      context: buildContext(),
    });

    const monthlyPlansResponse = await (monthlyPlansLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/monthly-plans", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    expect((monthlyPlansResponse as { capacityHours: number }).capacityHours).toBe(160);
  });
});
