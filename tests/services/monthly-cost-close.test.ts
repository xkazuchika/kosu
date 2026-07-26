// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { createDailyAllocationPlan } from "../support/monthly-cost-close-fixtures";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation, updateEffortAllocation } from "../../app/db/repositories/effort-allocations";
import { createMember, updateMember } from "../../app/db/repositories/members";
import {
  listMonthlyCostCloseEvents,
  listMonthlyCostCloseProjectSnapshots,
} from "../../app/db/repositories/monthly-cost-closes";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { archiveProject, createProject, updateProject } from "../../app/db/repositories/projects";
import { approveMonthlyCostClose } from "../../app/services/monthly-cost-approval";
import { getMonthlyCostCompleteness } from "../../app/services/monthly-cost-completeness";
import {
  correctMissingHourlyCostSnapshot,
  getMonthlyCostCloseState,
  reopenMonthlyCostClose,
  requireOpenMonth,
  startMonthlyCostReview,
} from "../../app/services/monthly-cost-close";
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

function createActors() {
  const admin = createMember(db, {
    displayName: "Admin",
    email: "admin@example.com",
    passwordHash: "hash",
    role: "admin",
    hourlyCostRate: 2_000,
  });
  const member = createMember(db, {
    displayName: "Taro",
    email: "taro@example.com",
    passwordHash: "hash",
    hourlyCostRate: 1_000,
  });
  return { admin, member };
}

function createBillableProject() {
  return createProject(db, {
    code: "PRJ-001",
    name: "Website",
    projectType: "billable",
    contractRevenueAmount: 100_000,
    laborCostBudgetAmount: 60_000,
  });
}

function createBalancedActual(memberId: string, projectId: string, workDate = "2026-07-15", rate: number | null = 1_000) {
  const workLog = createDailyWorkLog(db, { memberId, workDate, totalWorkingHours: 8 });
  const allocation = createEffortAllocation(db, {
    dailyWorkLogId: workLog.id,
    memberId,
    projectId,
    allocatedHours: 8,
    hourlyCostRateSnapshot: rate,
  });
  return { allocation, workLog };
}

describe("monthly cost close lifecycle", () => {
  test("treats a missing row as open and appends audited lifecycle events", () => {
    const { admin } = createActors();

    expect(getMonthlyCostCloseState(db, "2026-07")).toMatchObject({ status: "open", isProtected: false });
    startMonthlyCostReview(db, {
      month: "2026-07",
      actorMemberId: admin.id,
      occurredAt: "2026-08-01T01:00:00.000Z",
    });
    expect(getMonthlyCostCloseState(db, "2026-07")).toMatchObject({ status: "in_review", isProtected: true });

    let protectedResponse: unknown;
    try {
      requireOpenMonth(db, "2026-07");
    } catch (error) {
      protectedResponse = error;
    }
    expect(protectedResponse).toBeInstanceOf(Response);
    expect((protectedResponse as Response).status).toBe(423);

    expect(() =>
      reopenMonthlyCostClose(db, { month: "2026-07", actorMemberId: admin.id, reason: " " }),
    ).toThrow("再オープン理由");
    reopenMonthlyCostClose(db, {
      month: "2026-07",
      actorMemberId: admin.id,
      reason: "入力漏れを修正するため",
      occurredAt: "2026-08-01T02:00:00.000Z",
    });

    const close = getMonthlyCostCloseState(db, "2026-07").close!;
    expect(close.status).toBe("open");
    expect(listMonthlyCostCloseEvents(db, close.id)).toMatchObject([
      { eventType: "entered_review", previousStatus: "open", nextStatus: "in_review" },
      {
        eventType: "reopened",
        previousStatus: "in_review",
        nextStatus: "open",
        reason: "入力漏れを修正するため",
      },
    ]);
  });

  test("reports stable blockers and a non-blocking daily/monthly plan warning", () => {
    const { member } = createActors();
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Website",
      projectType: "billable",
    });
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 10,
      hourlyCostRateSnapshot: null,
    });
    createDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    const workLog = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-02",
      totalWorkingHours: 8,
    });
    createEffortAllocation(db, {
      dailyWorkLogId: workLog.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 4,
      hourlyCostRateSnapshot: null,
    });

    const result = getMonthlyCostCompleteness(db, "2026-07");
    expect(result.blockers.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "UNBALANCED_WORK_LOG",
      "MISSING_MONTHLY_PLAN_COST",
      "MISSING_MONTHLY_ALLOCATION_COST",
      "MISSING_BILLABLE_CONTRACT_REVENUE",
      "MISSING_BILLABLE_LABOR_BUDGET",
    ]));
    expect(result.warnings.map((issue) => issue.code)).toContain("DAILY_MONTHLY_PLAN_MISMATCH");
  });

  test("does not treat zero activity or absent rows as incomplete", () => {
    const { member } = createActors();
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Zero activity",
      projectType: "billable",
    });
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 0,
      hourlyCostRateSnapshot: null,
    });

    expect(getMonthlyCostCompleteness(db, "2026-07")).toEqual({ blockers: [], warnings: [] });
  });

  test("reports missing historical cost snapshots needed by month-end cumulative values", () => {
    const { member } = createActors();
    const project = createBillableProject();
    createBalancedActual(member.id, project.id, "2026-06-30", null);

    expect(getMonthlyCostCompleteness(db, "2026-07").blockers).toEqual([
      expect.objectContaining({
        code: "MISSING_HISTORICAL_ALLOCATION_COST",
        workDate: "2026-06-30",
      }),
    ]);
  });

  test("corrects only missing snapshots with an explicit rate and reason and records the event", () => {
    const { admin, member } = createActors();
    const project = createBillableProject();
    const plan = createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 8,
      hourlyCostRateSnapshot: null,
    });

    expect(() =>
      correctMissingHourlyCostSnapshot(db, {
        month: "2026-07",
        actorMemberId: admin.id,
        targetType: "monthly_plan",
        targetId: plan.id,
        hourlyCostRate: 1_200,
        reason: "",
      }),
    ).toThrow("補正の理由");

    correctMissingHourlyCostSnapshot(db, {
      month: "2026-07",
      actorMemberId: admin.id,
      targetType: "monthly_plan",
      targetId: plan.id,
      hourlyCostRate: 1_200,
      reason: "雇用契約の単価を確認",
      occurredAt: "2026-08-01T00:00:00.000Z",
    });

    expect(listProjectFinancialReview(db, { month: "2026-07" })[0].monthlyPlanned.knownCost).toBe(9_600);
    const close = getMonthlyCostCloseState(db, "2026-07").close!;
    expect(listMonthlyCostCloseEvents(db, close.id)).toMatchObject([
      {
        eventType: "cost_snapshot_corrected",
        reason: "雇用契約の単価を確認",
        targetType: "monthly_plan",
        targetId: plan.id,
        nextHourlyCostRate: 1_200,
      },
    ]);
  });
});

describe("monthly cost approval", () => {
  test("rolls back snapshots and event when the final status update fails", () => {
    const { admin, member } = createActors();
    const project = createBillableProject();
    createBalancedActual(member.id, project.id);
    startMonthlyCostReview(db, { month: "2026-07", actorMemberId: admin.id });
    const close = getMonthlyCostCloseState(db, "2026-07").close!;
    connection.sqlite.exec(`
      create trigger reject_monthly_cost_approval
      before update of status on monthly_cost_closes
      when new.status = 'approved'
      begin
        select raise(abort, 'approval rejected');
      end
    `);

    expect(() => approveMonthlyCostClose(db, { month: "2026-07", actorMemberId: admin.id }))
      .toThrow("approval rejected");

    expect(getMonthlyCostCloseState(db, "2026-07").status).toBe("in_review");
    expect(listMonthlyCostCloseProjectSnapshots(db, close.id)).toEqual([]);
    expect(listMonthlyCostCloseEvents(db, close.id).map((event) => event.eventType)).toEqual(["entered_review"]);
  });

  test("keeps approved financial views immutable after master edits and future actuals", () => {
    const { admin, member } = createActors();
    const project = createBillableProject();
    createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 10,
      hourlyCostRateSnapshot: 1_000,
    });
    createBalancedActual(member.id, project.id);
    startMonthlyCostReview(db, { month: "2026-07", actorMemberId: admin.id });
    approveMonthlyCostClose(db, {
      month: "2026-07",
      actorMemberId: admin.id,
      occurredAt: "2026-08-01T00:00:00.000Z",
    });

    const approved = listProjectFinancialReview(db, { month: "2026-07" })[0];
    expect(approved).toMatchObject({
      source: "approved_snapshot",
      project: { name: "Website", isArchived: false },
      contractRevenueAmount: 100_000,
      laborCostBudgetAmount: 60_000,
      monthlyPlanned: { knownCost: 10_000 },
      monthlyActual: { knownCost: 8_000 },
      cumulativeActual: { knownCost: 8_000 },
    });

    updateProject(db, project.id, {
      name: "Renamed",
      contractRevenueAmount: 999_999,
      laborCostBudgetAmount: 1,
    });
    archiveProject(db, project.id, "2026-08-02T00:00:00.000Z");
    updateMember(db, member.id, { hourlyCostRate: 9_999 });
    const future = createBalancedActual(member.id, project.id, "2026-08-15", 9_999);
    updateEffortAllocation(db, future.allocation.id, { allocatedHours: 12 });

    expect(listProjectFinancialReview(db, { month: "2026-07" })[0]).toEqual(approved);
  });
});
