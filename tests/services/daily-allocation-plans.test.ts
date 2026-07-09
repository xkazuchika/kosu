// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { listDailyAllocationPlansByMemberAndDate, upsertDailyAllocationPlan } from "../../app/db/repositories/daily-allocation-plans";
import { createDailyWorkLog, findDailyWorkLogByMemberAndDate } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation, listAllocationsByWorkLog } from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import { createPeriodLock } from "../../app/db/repositories/period-locks";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import { createProject } from "../../app/db/repositories/projects";
import { DailyAllocationPlanError, copyDailyAllocationPlansToActuals, saveDailyAllocationPlans } from "../../app/services/daily-allocation-plans";
import { createTestDatabase } from "../db/helpers";

let db: KosuDatabase;
let connection: DatabaseConnection;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

function setupAssignedProject() {
  const member = createMember(db, {
    displayName: "Taro",
    email: "taro@example.com",
    passwordHash: "hash",
    hourlyCostRate: 5000,
  });
  const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
  createProjectAssignment(db, { memberId: member.id, projectId: project.id });

  return { member, project };
}

describe("daily allocation plan service", () => {
  test("bulk save upserts positive values and deletes empty or zero values", () => {
    const { member, project } = setupAssignedProject();
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });

    saveDailyAllocationPlans(db, {
      memberId: member.id,
      month: "2026-07",
      cells: [{ planDate: "2026-07-01", projectId: project.id, plannedHours: "0" }],
    });
    expect(listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01")).toHaveLength(0);

    saveDailyAllocationPlans(db, {
      memberId: member.id,
      month: "2026-07",
      cells: [{ planDate: "2026-07-01", projectId: project.id, plannedHours: "6" }],
    });
    expect(listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01")[0].plannedHours).toBe(6);

    saveDailyAllocationPlans(db, {
      memberId: member.id,
      month: "2026-07",
      cells: [{ planDate: "2026-07-01", projectId: project.id, plannedHours: "" }],
    });
    expect(listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01")).toHaveLength(0);
  });

  test("bulk save rejects invalid values and daily totals over 24 hours", () => {
    const { member, project } = setupAssignedProject();

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [{ planDate: "2026-07-01", projectId: project.id, plannedHours: "1.1" }],
      }),
    ).toThrow(DailyAllocationPlanError);

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [{ planDate: "2026-07-01", projectId: project.id, plannedHours: "24.25" }],
      }),
    ).toThrow(DailyAllocationPlanError);
  });

  test("bulk save rejects unassigned projects and locked months", () => {
    const { member } = setupAssignedProject();
    const unassignedProject = createProject(db, { code: "PRJ-002", name: "App", projectType: "internal" });

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [{ planDate: "2026-07-01", projectId: unassignedProject.id, plannedHours: "4" }],
      }),
    ).toThrow(DailyAllocationPlanError);

    createPeriodLock(db, { month: "2026-07", isLocked: true });
    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [{ planDate: "2026-07-01", projectId: unassignedProject.id, plannedHours: "" }],
      }),
    ).toThrow(Response);
  });

  test("copy creates actuals, fills empty work logs, skips existing allocations, and is idempotent", () => {
    const { member, project } = setupAssignedProject();
    const projectB = createProject(db, { code: "PRJ-002", name: "App", projectType: "internal" });
    createProjectAssignment(db, { memberId: member.id, projectId: projectB.id });

    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: project.id, planDate: "2026-07-01", plannedHours: 4 });
    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: projectB.id, planDate: "2026-07-01", plannedHours: 2 });
    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: project.id, planDate: "2026-07-02", plannedHours: 3 });
    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: project.id, planDate: "2026-07-03", plannedHours: 5 });

    createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-02", totalWorkingHours: 1 });
    const existingLog = createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-03", totalWorkingHours: 8 });
    createEffortAllocation(db, {
      dailyWorkLogId: existingLog.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 8,
      hourlyCostRateSnapshot: 5000,
    });

    const firstSummary = copyDailyAllocationPlansToActuals(db, { memberId: member.id, month: "2026-07" });
    expect(firstSummary).toMatchObject({ copiedDates: 2, createdAllocations: 3, skippedExistingActualDates: 1 });

    const createdLog = findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-01")!;
    expect(createdLog.totalWorkingHours).toBe(6);
    expect(listAllocationsByWorkLog(db, createdLog.id)).toHaveLength(2);

    const filledLog = findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-02")!;
    expect(filledLog.totalWorkingHours).toBe(3);
    expect(listAllocationsByWorkLog(db, filledLog.id)).toHaveLength(1);

    const secondSummary = copyDailyAllocationPlansToActuals(db, { memberId: member.id, month: "2026-07" });
    expect(secondSummary.copiedDates).toBe(0);
    expect(secondSummary.createdAllocations).toBe(0);
    expect(secondSummary.skippedExistingActualDates).toBe(3);
  });
});
