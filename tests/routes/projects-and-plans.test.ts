// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation } from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { members } from "../../app/db/schema";
import { loader as projectsLoader } from "../../app/routes/projects";
import {
  action as newProjectAction,
  loader as newProjectLoader,
} from "../../app/routes/projects.new";
import {
  action as projectDetailAction,
  loader as projectDetailLoader,
} from "../../app/routes/projects.$id";
import {
  action as projectTasksAction,
  loader as projectTasksLoader,
} from "../../app/routes/projects.$id.tasks";
import {
  action as projectAssignmentsAction,
  loader as projectAssignmentsLoader,
} from "../../app/routes/projects.$id.assignments";
import {
  action as selfAssignAction,
  loader as selfAssignLoader,
} from "../../app/routes/self-assign";
import { loader as monthlyPlansLoader } from "../../app/routes/monthly-plans";
import {
  action as monthlyPlansAdminAction,
  loader as monthlyPlansAdminLoader,
} from "../../app/routes/monthly-plans.admin";
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
    `kosu-projects-plans-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe("projects, tasks, assignments, and plans routes", () => {
  test("admin creates and archives a project", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const createResponse = await createProject(
      cookie,
      "PRJ-001",
      "Website",
      "billable",
    );
    expect(createResponse).toBeInstanceOf(Response);
    expect((createResponse as Response).headers.get("Location")).toBe(
      "/projects",
    );

    const listResponse = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const listData = listResponse as {
      projects: { id: string; code: string }[];
    };
    expect(listData.projects.some((p) => p.code === "PRJ-001")).toBe(true);

    const project = listData.projects.find((p) => p.code === "PRJ-001")!;
    const archiveForm = new FormData();
    archiveForm.append("intent", "archive");

    const archiveResponse = await (
      projectDetailAction as unknown as RouteActionHandler
    )({
      request: buildRequest(archiveForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });
    expect(archiveResponse).toBeInstanceOf(Response);
    expect((archiveResponse as Response).headers.get("Location")).toBe(
      "/projects",
    );
  });

  test("admin configures a project effort budget and sees derived effort overview", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const formData = new FormData();
    formData.append("code", "PRJ-BUDGET");
    formData.append("name", "Budgeted project");
    formData.append("projectType", "billable");
    formData.append("effortBudgetHours", "400.25");

    await (newProjectAction as unknown as RouteActionHandler)({
      request: buildRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    const list = await (projectsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const project = (
      list as { projects: { id: string; effortBudgetHours: number }[] }
    ).projects[0];
    expect(project.effortBudgetHours).toBe(400.25);

    const detail = await (projectDetailLoader as unknown as RouteLoaderHandler)(
      {
        request: new Request(`http://localhost/projects/${project.id}`, {
          headers: { Cookie: cookie },
        }),
        params: { id: project.id },
        context: buildContext(),
      },
    );
    expect(
      (
        detail as {
          effort: { effortBudgetHours: number; plannedHours: number };
        }
      ).effort,
    ).toMatchObject({ effortBudgetHours: 400.25, plannedHours: 0 });

    for (const invalid of ["-1", "1.1", "abc"]) {
      const invalidForm = new FormData();
      invalidForm.append("code", `INVALID-${invalid}`);
      invalidForm.append("name", "Invalid");
      invalidForm.append("projectType", "internal");
      invalidForm.append("effortBudgetHours", invalid);
      const response = await (
        newProjectAction as unknown as RouteActionHandler
      )({
        request: buildRequest(invalidForm, cookie),
        params: {},
        context: buildContext(),
      });
      expect(response).toMatchObject({
        error: "工数予算は0以上、0.25時間単位で入力してください。",
      });
    }
  });

  test("project financial baseline is admin-only and does not leak through member project data", async () => {
    const adminCookie = await setupAndLogin(dataDir, "password123");
    const formData = new FormData();
    formData.append("code", "PRJ-001");
    formData.append("name", "Website");
    formData.append("projectType", "billable");
    formData.append("contractRevenueAmount", "1000000");
    formData.append("laborCostBudgetAmount", "600000");

    await (newProjectAction as unknown as RouteActionHandler)({
      request: buildRequest(formData, adminCookie),
      params: {},
      context: buildContext(),
    });

    const adminProjects = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: adminCookie },
      }),
      context: buildContext(),
    });
    const project = (
      adminProjects as {
        projects: {
          contractRevenueAmount: number;
          id: string;
          laborCostBudgetAmount: number;
        }[];
      }
    ).projects[0];
    expect(project.contractRevenueAmount).toBe(1_000_000);
    expect(project.laborCostBudgetAmount).toBe(600_000);

    const memberCookie = await setupAndLogin(dataDir, "password123", "member");
    const selfAssignForm = new FormData();
    selfAssignForm.append("projectId", project.id);
    await (selfAssignAction as unknown as RouteActionHandler)({
      request: buildRequest(selfAssignForm, memberCookie),
      params: {},
      context: buildContext(),
    });

    const memberProjects = await (
      projectsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/projects", {
        headers: { Cookie: memberCookie },
      }),
      context: buildContext(),
    });
    const memberProject = (
      memberProjects as { projects: Record<string, unknown>[] }
    ).projects[0];
    expect(memberProject).not.toHaveProperty("contractRevenueAmount");
    expect(memberProject).not.toHaveProperty("laborCostBudgetAmount");
    expect(memberProject).not.toHaveProperty("revenueOrBudgetAmount");
  });

  test("member cannot open project creation form with financial inputs", async () => {
    const memberCookie = await setupAndLogin(dataDir, "password123", "member");

    await expect(
      (newProjectLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/projects/new", {
          headers: { Cookie: memberCookie },
        }),
        context: buildContext(),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("admin creates a task under a project", async () => {
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

    const taskForm = new FormData();
    taskForm.append("name", "Design");

    await (projectTasksAction as unknown as RouteActionHandler)({
      request: buildRequest(taskForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });

    const tasksResponse = await (
      projectTasksLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(`http://localhost/projects/${project.id}/tasks`, {
        headers: { Cookie: cookie },
      }),
      params: { id: project.id },
      context: buildContext(),
    });
    expect(
      (tasksResponse as { tasks: { name: string }[] }).tasks.some(
        (t) => t.name === "Design",
      ),
    ).toBe(true);
  });

  test("admin assigns member to project", async () => {
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

    const assignmentsResponse = await (
      projectAssignmentsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        `http://localhost/projects/${project.id}/assignments`,
        { headers: { Cookie: cookie } },
      ),
      params: { id: project.id },
      context: buildContext(),
    });
    const adminMember = (assignmentsResponse as { members: { id: string }[] })
      .members[0];

    const assignForm = new FormData();
    assignForm.append("memberId", adminMember.id);
    assignForm.append("assignmentRole", "Engineer");

    await (projectAssignmentsAction as unknown as RouteActionHandler)({
      request: buildRequest(assignForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });

    const updatedAssignments = await (
      projectAssignmentsLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        `http://localhost/projects/${project.id}/assignments`,
        { headers: { Cookie: cookie } },
      ),
      params: { id: project.id },
      context: buildContext(),
    });
    expect(
      (updatedAssignments as { assignments: { assignmentRole: string }[] })
        .assignments[0].assignmentRole,
    ).toBe("Engineer");
  });

  test("member self-assigns to existing active project", async () => {
    const adminCookie = await setupAndLogin(dataDir, "password123");
    await createProject(adminCookie, "PRJ-001", "Website", "internal");

    const memberCookie = await setupAndLogin(dataDir, "password123", "member");

    const selfAssignResponse = await (
      selfAssignLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/self-assign", {
        headers: { Cookie: memberCookie },
      }),
      context: buildContext(),
    });
    const availableProjects = (
      selfAssignResponse as { availableProjects: { id: string }[] }
    ).availableProjects;
    expect(availableProjects.length).toBeGreaterThan(0);

    const formData = new FormData();
    formData.append("projectId", availableProjects[0].id);

    const actionResponse = await (
      selfAssignAction as unknown as RouteActionHandler
    )({
      request: buildRequest(formData, memberCookie),
      params: {},
      context: buildContext(),
    });
    expect(actionResponse).toBeInstanceOf(Response);
    expect((actionResponse as Response).headers.get("Location")).toBe(
      "/projects",
    );
  });

  test("admin manages monthly capacity and plan", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const capacityForm = new FormData();
    capacityForm.append("intent", "capacity");
    capacityForm.append("memberId", "will-be-replaced");
    capacityForm.append("month", "2026-07");
    capacityForm.append("capacityHours", "160");

    const adminLoader = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    const adminMember = (adminLoader as { members: { id: string }[] })
      .members[0];
    capacityForm.set("memberId", adminMember.id);

    await (monthlyPlansAdminAction as unknown as RouteActionHandler)({
      request: buildRequest(capacityForm, cookie),
      params: {},
      context: buildContext(),
    });

    const monthlyPlansResponse = await (
      monthlyPlansLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/monthly-plans?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    expect(
      (monthlyPlansResponse as { capacityHours: number }).capacityHours,
    ).toBe(160);
  });

  test("admin creates monthly project plan without capacity", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );
    connection.db
      .update(members)
      .set({ hourlyCostRate: 5_000 })
      .where(eq(members.email, "admin@example.com"))
      .run();
    connection.sqlite.close();
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
    const adminMember = await assignAdminToProject(cookie, project.id);

    const planForm = new FormData();
    planForm.append("intent", "plan");
    planForm.append("memberId", adminMember.id);
    planForm.append("projectId", project.id);
    planForm.append("month", "2026-07");
    planForm.append("assignmentRole", "Engineer");
    planForm.append("plannedHours", "24");

    await (monthlyPlansAdminAction as unknown as RouteActionHandler)({
      request: buildRequest(planForm, cookie),
      params: {},
      context: buildContext(),
    });

    const monthlyPlansResponse = await (
      monthlyPlansLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/monthly-plans?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    expect(
      (monthlyPlansResponse as { capacityHours: number | null }).capacityHours,
    ).toBeNull();
    expect(
      (monthlyPlansResponse as { totalPlanned: number }).totalPlanned,
    ).toBe(24);

    const adminResponse = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    expect(
      (
        adminResponse as {
          planRows: { hourlyCostRateSnapshot: number | null }[];
        }
      ).planRows[0].hourlyCostRateSnapshot,
    ).toBe(5_000);
  });

  test("admin can save a plan above the project effort budget and sees a warning state", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const projectForm = new FormData();
    projectForm.append("code", "LIMITED");
    projectForm.append("name", "Limited project");
    projectForm.append("projectType", "internal");
    projectForm.append("effortBudgetHours", "10");
    await (newProjectAction as unknown as RouteActionHandler)({
      request: buildRequest(projectForm, cookie),
      params: {},
      context: buildContext(),
    });
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
    ).projects.find((item) => item.code === "LIMITED")!;
    const member = await assignAdminToProject(cookie, project.id);
    const planForm = new FormData();
    planForm.append("intent", "plan");
    planForm.append("memberId", member.id);
    planForm.append("projectId", project.id);
    planForm.append("month", "2026-07");
    planForm.append("plannedHours", "12");

    const result = await (
      monthlyPlansAdminAction as unknown as RouteActionHandler
    )({
      request: buildRequest(planForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect(result).toBeNull();
    const loaded = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    expect(
      (
        loaded as {
          projectEffort: {
            projectId: string;
            plannedHours: number;
            isOverPlanned: boolean;
          }[];
        }
      ).projectEffort.find((item) => item.projectId === project.id),
    ).toMatchObject({ plannedHours: 12, isOverPlanned: true });
  });

  test("member monthly plan shows own actual and balance without other plans or costs", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await createProject(cookie, "MEMBER-PLAN", "Member project", "internal");
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
    ).projects.find((item) => item.code === "MEMBER-PLAN")!;
    const currentMember = await assignAdminToProject(cookie, project.id);
    const connection = createDatabaseConnection();
    const other = createMember(connection.db, {
      displayName: "Other",
      email: "other@example.com",
      passwordHash: "secret-hash",
      hourlyCostRate: 9000,
    });
    createMonthlyPlan(connection.db, {
      memberId: currentMember.id,
      projectId: project.id,
      month: "2026-07",
      assignmentRole: "Engineer",
      plannedHours: 10,
      hourlyCostRateSnapshot: 5000,
    });
    createMonthlyPlan(connection.db, {
      memberId: currentMember.id,
      projectId: project.id,
      month: "2026-07",
      assignmentRole: "Reviewer",
      plannedHours: 6,
      hourlyCostRateSnapshot: 5000,
    });
    createMonthlyPlan(connection.db, {
      memberId: other.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 99,
      hourlyCostRateSnapshot: 9000,
    });
    const log = createDailyWorkLog(connection.db, {
      memberId: currentMember.id,
      workDate: "2026-07-15",
      totalWorkingHours: 4,
    });
    createEffortAllocation(connection.db, {
      dailyWorkLogId: log.id,
      memberId: currentMember.id,
      projectId: project.id,
      allocatedHours: 4,
      hourlyCostRateSnapshot: 5000,
    });
    connection.db
      .update(members)
      .set({ role: "member", hourlyCostRate: 5000 })
      .where(eq(members.id, currentMember.id))
      .run();
    connection.sqlite.close();

    const loaded = await (monthlyPlansLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/monthly-plans?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const data = loaded as {
      plans: {
        memberId: string;
        plannedHours: number;
        actualHours: number;
        balanceHours: number;
      }[];
    };
    expect(data.plans).toEqual([
      expect.objectContaining({
        memberId: currentMember.id,
        plannedHours: 16,
        actualHours: 4,
        balanceHours: 12,
        assignmentRole: "Engineer / Reviewer",
      }),
    ]);
    const payload = JSON.stringify(loaded);
    expect(payload).not.toContain(other.id);
    expect(payload).not.toContain("hourlyCostRate");
    expect(payload).not.toContain("passwordHash");
  });

  test("monthly planning loaders use selected target month", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const adminResponse = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-08",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    expect((adminResponse as { month: string }).month).toBe("2026-08");

    const memberResponse = await (
      monthlyPlansLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/monthly-plans?month=2026-08", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    expect((memberResponse as { currentMonth: string }).currentMonth).toBe(
      "2026-08",
    );
  });

  test("member monthly plan payload exposes non-admin role for UI link hiding", async () => {
    const memberCookie = await setupAndLogin(dataDir, "password123", "member");

    const memberResponse = await (
      monthlyPlansLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/monthly-plans?month=2026-07", {
        headers: { Cookie: memberCookie },
      }),
      context: buildContext(),
    });
    expect((memberResponse as { isAdmin: boolean }).isAdmin).toBe(false);
  });

  test("admin updates and deletes monthly project plan rows", async () => {
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
    const adminMember = await assignAdminToProject(cookie, project.id);

    const planForm = new FormData();
    planForm.append("intent", "plan");
    planForm.append("memberId", adminMember.id);
    planForm.append("projectId", project.id);
    planForm.append("month", "2026-07");
    planForm.append("assignmentRole", "Engineer");
    planForm.append("plannedHours", "24");
    await (monthlyPlansAdminAction as unknown as RouteActionHandler)({
      request: buildRequest(planForm, cookie),
      params: {},
      context: buildContext(),
    });

    const adminResponse = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    const planRow = (
      adminResponse as {
        planRows: {
          id: string;
          memberName: string;
          projectName: string;
          plannedHours: number;
        }[];
      }
    ).planRows[0];
    expect(planRow).toMatchObject({
      memberName: "Admin",
      projectName: "Website",
      plannedHours: 24,
    });

    const updateForm = new FormData();
    updateForm.append("intent", "updatePlan");
    updateForm.append("id", planRow.id);
    updateForm.append("month", "2026-07");
    updateForm.append("assignmentRole", "Lead");
    updateForm.append("plannedHours", "32");
    await (monthlyPlansAdminAction as unknown as RouteActionHandler)({
      request: buildRequest(updateForm, cookie),
      params: {},
      context: buildContext(),
    });

    const updatedAdminResponse = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    const updatedPlanRow = (
      updatedAdminResponse as {
        planRows: {
          id: string;
          assignmentRole: string;
          plannedHours: number;
        }[];
      }
    ).planRows[0];
    expect(updatedPlanRow).toMatchObject({
      assignmentRole: "Lead",
      plannedHours: 32,
    });

    const deleteForm = new FormData();
    deleteForm.append("intent", "deletePlan");
    deleteForm.append("id", planRow.id);
    deleteForm.append("month", "2026-07");
    await (monthlyPlansAdminAction as unknown as RouteActionHandler)({
      request: buildRequest(deleteForm, cookie),
      params: {},
      context: buildContext(),
    });

    const deletedAdminResponse = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    expect(
      (deletedAdminResponse as { planRows: unknown[] }).planRows,
    ).toHaveLength(0);
  });

  test("monthly plan admin rejects invalid hours and non-calendar months", async () => {
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
    const adminMember = await assignAdminToProject(cookie, project.id);

    const negativeForm = new FormData();
    negativeForm.append("intent", "plan");
    negativeForm.append("memberId", adminMember.id);
    negativeForm.append("projectId", project.id);
    negativeForm.append("month", "2026-07");
    negativeForm.append("plannedHours", "-8");

    const negativeResponse = await (
      monthlyPlansAdminAction as unknown as RouteActionHandler
    )({
      request: buildRequest(negativeForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect((negativeResponse as { error: string }).error).toContain("0.25h");

    const nonQuarterForm = new FormData();
    nonQuarterForm.append("intent", "plan");
    nonQuarterForm.append("memberId", adminMember.id);
    nonQuarterForm.append("projectId", project.id);
    nonQuarterForm.append("month", "2026-07");
    nonQuarterForm.append("plannedHours", "8.1");

    const nonQuarterResponse = await (
      monthlyPlansAdminAction as unknown as RouteActionHandler
    )({
      request: buildRequest(nonQuarterForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect((nonQuarterResponse as { error: string }).error).toContain("0.25h");

    const invalidMonthForm = new FormData();
    invalidMonthForm.append("intent", "plan");
    invalidMonthForm.append("memberId", adminMember.id);
    invalidMonthForm.append("projectId", project.id);
    invalidMonthForm.append("month", "2026-13");
    invalidMonthForm.append("plannedHours", "8");

    const invalidMonthResponse = await (
      monthlyPlansAdminAction as unknown as RouteActionHandler
    )({
      request: buildRequest(invalidMonthForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect((invalidMonthResponse as { error: string }).error).toContain(
      "実在する月",
    );
  });

  test("self-assign rejects archived projects and unknown project ids", async () => {
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

    const archiveForm = new FormData();
    archiveForm.append("intent", "archive");
    await (projectDetailAction as unknown as RouteActionHandler)({
      request: buildRequest(archiveForm, cookie),
      params: { id: project.id },
      context: buildContext(),
    });

    const archivedForm = new FormData();
    archivedForm.append("projectId", project.id);
    const archivedResponse = await (
      selfAssignAction as unknown as RouteActionHandler
    )({
      request: buildRequest(archivedForm, cookie),
      params: {},
      context: buildContext(),
    });
    expect((archivedResponse as { error: string }).error).toContain(
      "アーカイブ済み",
    );

    const unknownForm = new FormData();
    unknownForm.append("projectId", "missing-project-id");
    await expect(
      (selfAssignAction as unknown as RouteActionHandler)({
        request: buildRequest(unknownForm, cookie),
        params: {},
        context: buildContext(),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test("monthly plan responses do not expose member credential or cost fields", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const memberResponse = await (
      monthlyPlansLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/monthly-plans?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    const memberPayload = JSON.stringify(memberResponse);
    expect(memberPayload).not.toContain("passwordHash");
    expect(memberPayload).not.toContain("hourlyCostRate");

    const adminResponse = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        { headers: { Cookie: cookie } },
      ),
      context: buildContext(),
    });
    const adminPayload = JSON.stringify(adminResponse);
    expect(adminPayload).not.toContain("passwordHash");
    expect(
      (
        adminResponse as {
          capacities: { memberId: string; displayName: string }[];
        }
      ).capacities[0],
    ).toMatchObject({
      memberId: expect.any(String),
      displayName: "Admin",
    });
    expect(
      (adminResponse as { capacities: Record<string, unknown>[] })
        .capacities[0],
    ).not.toHaveProperty("member");
  });
});
