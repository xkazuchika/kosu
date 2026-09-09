// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import {
  listDailyAllocationPlansByMemberAndDate,
  upsertDailyAllocationPlan,
} from "../../app/db/repositories/daily-allocation-plans";
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
import { findMonthlyEffortSubmission } from "../../app/db/repositories/monthly-effort-submissions";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import { createProject } from "../../app/db/repositories/projects";
import {
  DailyAllocationPlanError,
  copyDailyAllocationPlansToActuals,
  saveDailyAllocationPlans,
} from "../../app/services/daily-allocation-plans";
import { startMonthlyCostReview } from "../../app/services/monthly-cost-close";
import { submitMonthlyEffort } from "../../app/services/monthly-effort-submission";
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
  const project = createProject(db, {
    code: "PRJ-001",
    name: "Website",
    projectType: "billable",
  });
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
      cells: [
        { planDate: "2026-07-01", projectId: project.id, plannedHours: "0" },
      ],
    });
    expect(
      listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01"),
    ).toHaveLength(0);

    saveDailyAllocationPlans(db, {
      memberId: member.id,
      month: "2026-07",
      cells: [
        { planDate: "2026-07-01", projectId: project.id, plannedHours: "6" },
      ],
    });
    expect(
      listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01")[0]
        .plannedHours,
    ).toBe(6);

    saveDailyAllocationPlans(db, {
      memberId: member.id,
      month: "2026-07",
      cells: [
        { planDate: "2026-07-01", projectId: project.id, plannedHours: "" },
      ],
    });
    expect(
      listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01"),
    ).toHaveLength(0);
  });

  test("bulk save rejects invalid values and daily totals over 24 hours", () => {
    const { member, project } = setupAssignedProject();

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [
          {
            planDate: "2026-07-01",
            projectId: project.id,
            plannedHours: "1.1",
          },
        ],
      }),
    ).toThrow(DailyAllocationPlanError);

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [
          { planDate: "2026-07-32", projectId: project.id, plannedHours: "4" },
        ],
      }),
    ).toThrow("対象月の日付");

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [
          {
            planDate: "2026-07-01",
            projectId: project.id,
            plannedHours: "24.25",
          },
        ],
      }),
    ).toThrow(DailyAllocationPlanError);
  });

  test("bulk save rejects unassigned projects and locked months", () => {
    const { member } = setupAssignedProject();
    const unassignedProject = createProject(db, {
      code: "PRJ-002",
      name: "App",
      projectType: "internal",
    });

    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [
          {
            planDate: "2026-07-01",
            projectId: unassignedProject.id,
            plannedHours: "4",
          },
        ],
      }),
    ).toThrow(DailyAllocationPlanError);

    startMonthlyCostReview(db, { month: "2026-07", actorMemberId: member.id });
    expect(() =>
      saveDailyAllocationPlans(db, {
        memberId: member.id,
        month: "2026-07",
        cells: [
          {
            planDate: "2026-07-01",
            projectId: unassignedProject.id,
            plannedHours: "",
          },
        ],
      }),
    ).toThrow(Response);
  });

  test("copy creates actuals, fills empty work logs, skips existing allocations, and is idempotent", () => {
    const { member, project } = setupAssignedProject();
    const projectB = createProject(db, {
      code: "PRJ-002",
      name: "App",
      projectType: "internal",
    });
    createProjectAssignment(db, {
      memberId: member.id,
      projectId: projectB.id,
    });

    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: projectB.id,
      planDate: "2026-07-01",
      plannedHours: 2,
    });
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-02",
      plannedHours: 3,
    });
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-03",
      plannedHours: 5,
    });

    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-02",
      totalWorkingHours: 1,
    });
    const existingLog = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-03",
      totalWorkingHours: 8,
    });
    createEffortAllocation(db, {
      dailyWorkLogId: existingLog.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 8,
      hourlyCostRateSnapshot: 5000,
    });

    const firstSummary = copyDailyAllocationPlansToActuals(db, {
      memberId: member.id,
      month: "2026-07",
    });
    expect(firstSummary).toMatchObject({
      copiedDates: 2,
      createdAllocations: 3,
      skippedExistingActualDates: 1,
    });

    const createdLog = findDailyWorkLogByMemberAndDate(
      db,
      member.id,
      "2026-07-01",
    )!;
    expect(createdLog.totalWorkingHours).toBe(6);
    expect(listAllocationsByWorkLog(db, createdLog.id)).toHaveLength(2);

    const filledLog = findDailyWorkLogByMemberAndDate(
      db,
      member.id,
      "2026-07-02",
    )!;
    expect(filledLog.totalWorkingHours).toBe(3);
    expect(listAllocationsByWorkLog(db, filledLog.id)).toHaveLength(1);

    const secondSummary = copyDailyAllocationPlansToActuals(db, {
      memberId: member.id,
      month: "2026-07",
    });
    expect(secondSummary.copiedDates).toBe(0);
    expect(secondSummary.createdAllocations).toBe(0);
    expect(secondSummary.skippedExistingActualDates).toBe(3);
  });

  test("plan-to-actual copy invalidates after copying but skipped and failed copies preserve submission", () => {
    const { member, project } = setupAssignedProject();
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    submitMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-07",
      actorMemberId: member.id,
    });

    copyDailyAllocationPlansToActuals(db, {
      memberId: member.id,
      month: "2026-07",
    });
    expect(findMonthlyEffortSubmission(db, member.id, "2026-07")?.status).toBe(
      "draft",
    );

    submitMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-07",
      actorMemberId: member.id,
    });
    expect(
      copyDailyAllocationPlansToActuals(db, {
        memberId: member.id,
        month: "2026-07",
      }).copiedDates,
    ).toBe(0);
    expect(findMonthlyEffortSubmission(db, member.id, "2026-07")?.status).toBe(
      "submitted",
    );

    connection.sqlite.exec(`
      INSERT INTO daily_allocation_plans
        (id, member_id, project_id, plan_date, planned_hours, created_at, updated_at)
      VALUES
        ('invalid-plan', '${member.id}', '${project.id}', '2026-08-01', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    submitMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-08",
      actorMemberId: member.id,
    });
    expect(() =>
      copyDailyAllocationPlansToActuals(db, {
        memberId: member.id,
        month: "2026-08",
      }),
    ).toThrow("24h以下");
    expect(findMonthlyEffortSubmission(db, member.id, "2026-08")?.status).toBe(
      "submitted",
    );
  });

  test("planned-to-actual copy re-enters a cleared day", () => {
    const { member, project } = setupAssignedProject();
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    const original = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 8,
    });
    deleteDailyWorkLog(db, original.id, "2026-07-02T00:00:00.000Z");

    copyDailyAllocationPlansToActuals(db, {
      memberId: member.id,
      month: "2026-07",
    });

    const restored = findDailyWorkLogByMemberAndDate(
      db,
      member.id,
      "2026-07-01",
    )!;
    expect(restored).toMatchObject({ id: original.id, totalWorkingHours: 4 });
    expect(listAllocationsByWorkLog(db, restored.id)).toHaveLength(1);
  });

  test("planned-to-actual copy rejects legacy values over a day atomically", () => {
    const { member, project } = setupAssignedProject();
    const second = createProject(db, {
      code: "PRJ-002",
      name: "Second",
      projectType: "internal",
    });
    createProjectAssignment(db, {
      memberId: member.id,
      projectId: second.id,
    });
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 20,
    });
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: second.id,
      planDate: "2026-07-01",
      plannedHours: 5,
    });

    expect(() =>
      copyDailyAllocationPlansToActuals(db, {
        memberId: member.id,
        month: "2026-07",
      }),
    ).toThrow("24h以下");
    expect(
      findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-01"),
    ).toBeUndefined();
  });
});
