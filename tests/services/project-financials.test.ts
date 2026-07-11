// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation } from "../../app/db/repositories/effort-allocations";
import { createMember, updateMember } from "../../app/db/repositories/members";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { archiveProject, createProject } from "../../app/db/repositories/projects";
import { listProjectFinancialReview } from "../../app/services/project-financials";
import { createTestDatabase } from "../db/helpers";

let connection: DatabaseConnection;
let db: KosuDatabase;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

function createCostedMember(hourlyCostRate = 1_000) {
  return createMember(db, {
    displayName: "Taro",
    email: "taro@example.com",
    passwordHash: "hash",
    hourlyCostRate,
  });
}

function createAllocation(memberId: string, projectId: string, hourlyCostRateSnapshot: number | null, allocatedHours = 8) {
  const workLog = createDailyWorkLog(db, { memberId, workDate: "2026-07-15", totalWorkingHours: allocatedHours });
  return createEffortAllocation(db, { dailyWorkLogId: workLog.id, memberId, projectId, allocatedHours, hourlyCostRateSnapshot });
}

describe("project financial review", () => {
  test("uses saved rate snapshots for monthly and cumulative labor cost", () => {
    const member = createCostedMember();
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Website",
      projectType: "billable",
      contractRevenueAmount: 100_000,
      laborCostBudgetAmount: 60_000,
    });
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 10,
      hourlyCostRateSnapshot: 1_000,
    });
    createAllocation(member.id, project.id, 1_250);
    updateMember(db, member.id, { hourlyCostRate: 9_000 });

    const row = listProjectFinancialReview(db, { month: "2026-07" })[0];

    expect(row.monthlyPlanned).toMatchObject({ knownCost: 10_000, missingCostHours: 0, missingCostRows: 0 });
    expect(row.monthlyActual).toMatchObject({ knownCost: 10_000, missingCostHours: 0, missingCostRows: 0 });
    expect(row.cumulativeActual.knownCost).toBe(10_000);
    expect(row.remainingLaborCostBudget).toBe(50_000);
    expect(row.laborBudgetConsumption).toBeCloseTo(1 / 6);
    expect(row.targetLaborGrossProfit).toBe(40_000);
    expect(row.targetLaborGrossProfitRate).toBeCloseTo(0.4);
  });

  test("marks dependent financial metrics incomplete when snapshots are missing", () => {
    const member = createCostedMember();
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Website",
      projectType: "billable",
      contractRevenueAmount: 100_000,
      laborCostBudgetAmount: 60_000,
    });
    createMonthlyPlan(db, { memberId: member.id, projectId: project.id, month: "2026-07", plannedHours: 4 });
    createAllocation(member.id, project.id, null, 2);
    archiveProject(db, project.id, "2026-07-31T00:00:00.000Z");

    const row = listProjectFinancialReview(db, { month: "2026-07" })[0];

    expect(row.monthlyPlanned).toMatchObject({ knownCost: 0, missingCostHours: 4, missingCostRows: 1 });
    expect(row.monthlyActual).toMatchObject({ knownCost: 0, missingCostHours: 2, missingCostRows: 1 });
    expect(row.cumulativeActual).toMatchObject({ knownCost: 0, missingCostHours: 2, missingCostRows: 1 });
    expect(row.remainingLaborCostBudget).toBeNull();
    expect(row.laborBudgetConsumption).toBeNull();
    expect(row.finalLaborGrossProfit).toBeNull();
  });

  test("shows final labor gross profit only for archived projects with complete cost data", () => {
    const member = createCostedMember();
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Website",
      projectType: "billable",
      contractRevenueAmount: 100_000,
      laborCostBudgetAmount: 60_000,
    });
    createAllocation(member.id, project.id, 2_000, 10);

    expect(listProjectFinancialReview(db, { month: "2026-07" })[0].finalLaborGrossProfit).toBeNull();

    archiveProject(db, project.id, "2026-07-31T00:00:00.000Z");
    const archived = listProjectFinancialReview(db, { month: "2026-07" })[0];

    expect(archived.finalLaborGrossProfit).toBe(80_000);
    expect(archived.finalLaborGrossProfitRate).toBeCloseTo(0.8);
  });

  test("avoids percentage calculations with zero revenue or budget", () => {
    const member = createCostedMember();
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Internal",
      projectType: "internal",
      contractRevenueAmount: 0,
      laborCostBudgetAmount: 0,
    });
    createAllocation(member.id, project.id, 1_000);

    const row = listProjectFinancialReview(db, { month: "2026-07" })[0];

    expect(row.laborBudgetConsumption).toBeNull();
    expect(row.targetLaborGrossProfitRate).toBeNull();
  });
});
