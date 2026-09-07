// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation } from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { createProject } from "../../app/db/repositories/projects";
import { getProjectEffortOverview } from "../../app/services/project-effort";
import { createTestDatabase } from "../db/helpers";

let connection: DatabaseConnection;
let db: KosuDatabase;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => connection.sqlite.close());

describe("project effort overview", () => {
  test("derives allocation, actual, remaining, and consumption from plans and actuals", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
    });
    const project = createProject(db, {
      code: "P-1",
      name: "Project",
      projectType: "billable",
      effortBudgetHours: 400,
    });
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 100,
    });
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-08",
      plannedHours: 150,
    });
    const log = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 8,
    });
    createEffortAllocation(db, {
      dailyWorkLogId: log.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 8,
    });

    expect(getProjectEffortOverview(db, project.id)).toMatchObject({
      effortBudgetHours: 400,
      plannedHours: 250,
      actualHours: 8,
      unallocatedHours: 150,
      remainingHours: 392,
      consumptionRate: 0.02,
      isOverPlanned: false,
      isOverActual: false,
    });
  });

  test("preserves negative balances as warnings and avoids dividing by zero", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
    });
    const project = createProject(db, {
      code: "P-1",
      name: "Project",
      projectType: "internal",
      effortBudgetHours: 0,
    });
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 2,
    });
    const log = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 1,
    });
    createEffortAllocation(db, {
      dailyWorkLogId: log.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 1,
    });

    expect(getProjectEffortOverview(db, project.id)).toMatchObject({
      unallocatedHours: -2,
      remainingHours: -1,
      consumptionRate: null,
      isOverPlanned: true,
      isOverActual: true,
    });
  });

  test("keeps budget balances absent when a project has no effort budget", () => {
    const project = createProject(db, {
      code: "P-1",
      name: "Project",
      projectType: "internal",
    });
    expect(getProjectEffortOverview(db, project.id)).toMatchObject({
      effortBudgetHours: null,
      unallocatedHours: null,
      remainingHours: null,
      consumptionRate: null,
    });
  });
});
