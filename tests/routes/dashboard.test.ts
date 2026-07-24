// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { loader as dashboardLoader } from "../../app/routes/dashboard";
import { buildContext, setupAndLogin, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe("dashboard", () => {
  test("uses the workspace timezone for today and current month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T15:30:00.000Z"));

    try {
      const cookie = await setupAndLogin(dataDir, "password123");
      const response = await (dashboardLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/dashboard", { headers: { Cookie: cookie } }),
        context: buildContext(),
      });

      expect(response).toMatchObject({
        today: "2026-08-01",
        currentMonth: "2026-08",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("admin dashboard shows monthly summary and assigned projects", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const response = await (dashboardLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/dashboard", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const data = response as {
      isAdmin: boolean;
      todayInput: { hasEntry: boolean };
      monthlySummary: { plannedHours: number; actualHours: number };
      assignedProjects: unknown[];
    };

    expect(data.isAdmin).toBe(true);
    expect(typeof data.todayInput.hasEntry).toBe("boolean");
    expect(typeof data.monthlySummary.plannedHours).toBe("number");
    expect(typeof data.monthlySummary.actualHours).toBe("number");
    expect(Array.isArray(data.assignedProjects)).toBe(true);
  });

  test("admin dashboard exposes operational project summaries without financial summary", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const response = await (dashboardLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/dashboard", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const data = response as {
      isAdmin: boolean;
      financialSummary?: unknown;
      projectSummaries: { plannedHours: number; actualHours: number; actualCost?: unknown; revenueOrBudgetAmount?: unknown }[] | null;
    };

    expect(data.isAdmin).toBe(true);
    expect(data.financialSummary).toBeUndefined();
    expect(Array.isArray(data.projectSummaries)).toBe(true);
    expect(data.projectSummaries?.[0]?.actualCost).toBeUndefined();
    expect(data.projectSummaries?.[0]?.revenueOrBudgetAmount).toBeUndefined();
  });

  test("member role only receives member-scoped dashboard data", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    const response = await (dashboardLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/dashboard", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const data = response as {
      isAdmin: boolean;
      financialSummary?: unknown;
      projectSummaries: unknown;
    };

    expect(data.isAdmin).toBe(false);
    expect(data.financialSummary).toBeUndefined();
    expect(data.projectSummaries).toBeNull();
  });
});
