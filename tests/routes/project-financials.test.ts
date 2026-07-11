// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation } from "../../app/db/repositories/effort-allocations";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { createProject } from "../../app/db/repositories/projects";
import { members } from "../../app/db/schema";
import { loader as projectFinancialLoader } from "../../app/routes/reports.project-financials";
import { buildContext, setupAndLogin, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-project-financials-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe("project financial review route", () => {
  test("administrator receives snapshot-based project financial metrics", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const admin = connection.db.select().from(members).where(eq(members.email, "admin@example.com")).get()!;
    connection.db.update(members).set({ hourlyCostRate: 1_000 }).where(eq(members.id, admin.id)).run();
    const project = createProject(connection.db, {
      code: "PRJ-001",
      name: "Website",
      projectType: "billable",
      contractRevenueAmount: 100_000,
      laborCostBudgetAmount: 60_000,
    });
    createMonthlyPlan(connection.db, {
      memberId: admin.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 10,
      hourlyCostRateSnapshot: 1_000,
    });
    const workLog = createDailyWorkLog(connection.db, { memberId: admin.id, workDate: "2026-07-15", totalWorkingHours: 8 });
    createEffortAllocation(connection.db, {
      dailyWorkLogId: workLog.id,
      memberId: admin.id,
      projectId: project.id,
      allocatedHours: 8,
      hourlyCostRateSnapshot: 1_000,
    });
    connection.sqlite.close();

    const response = await (projectFinancialLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/reports/project-financials?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const row = (response as { rows: { monthlyPlanned: { knownCost: number }; monthlyActual: { knownCost: number }; remainingLaborCostBudget: number; targetLaborGrossProfit: number }[] }).rows[0];

    expect(row.monthlyPlanned.knownCost).toBe(10_000);
    expect(row.monthlyActual.knownCost).toBe(8_000);
    expect(row.remainingLaborCostBudget).toBe(52_000);
    expect(row.targetLaborGrossProfit).toBe(40_000);
  });

  test("non-administrator cannot load financial metrics", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    await expect(
      (projectFinancialLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/reports/project-financials?month=2026-07", { headers: { Cookie: cookie } }),
        context: buildContext(),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
