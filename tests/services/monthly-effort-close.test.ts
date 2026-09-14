// @vitest-environment node
import { afterEach, beforeEach, expect, test } from "vitest";
import { createTestDatabase } from "../db/helpers";
import { createMember, updateMember } from "../../app/db/repositories/members";
import { createProject } from "../../app/db/repositories/projects";
import {
  createDailyWorkLog,
  updateDailyWorkLog,
} from "../../app/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  findAllocationById,
} from "../../app/db/repositories/effort-allocations";
import {
  createMonthlyPlan,
  findMonthlyPlanById,
} from "../../app/db/repositories/monthly-plans";
import { findMonthlyEffortSubmission } from "../../app/db/repositories/monthly-effort-submissions";
import {
  getOrCreateMonthlyCostClose,
  updateMonthlyCostClose,
  listMonthlyCostCloseEvents,
  listMonthlyCostCloseProjectSnapshots,
} from "../../app/db/repositories/monthly-cost-closes";
import { findMonthlyPlanReview } from "../../app/db/repositories/member-monthly-plan-reviews";
import {
  startMonthlyEffortReview,
  confirmMonthlyEffortClose,
} from "../../app/services/monthly-effort-close";
import { getMonthlyEffortCompleteness } from "../../app/services/monthly-effort-completeness";
import { getMonthlyCostCompleteness } from "../../app/services/monthly-cost-completeness";
import {
  correctMissingHourlyCostSnapshot,
  getMonthlyPeriodState,
  getMonthlyCostCloseState,
  startMonthlyCostReview,
  reopenMonthlyCostClose,
  requireOpenMonth,
} from "../../app/services/monthly-cost-close";
import { approveMonthlyCostClose } from "../../app/services/monthly-cost-approval";
import { submitMonthlyEffort } from "../../app/services/monthly-effort-submission";
import { confirmMonthlyPlan } from "../../app/services/monthly-plan-review";
import { listProjectFinancialReview } from "../../app/services/project-financials";

let connection: ReturnType<typeof createTestDatabase>;
const month = "2026-07";
beforeEach(() => {
  connection = createTestDatabase();
});
afterEach(() => {
  connection.sqlite.close();
});

function setup() {
  const { db, sqlite } = connection;
  const admin = createMember(db, {
    displayName: "Admin",
    email: "admin@test.com",
    passwordHash: "hash",
    role: "admin",
  });
  const member = createMember(db, {
    displayName: "Taro",
    email: "taro@test.com",
    passwordHash: "hash",
  });
  sqlite.exec("UPDATE members SET created_at = '2026-01-01'");
  const project = createProject(db, {
    code: "INT",
    name: "社内作業",
    projectType: "internal",
  });
  const input = { month, actorMemberId: admin.id };
  const submit = () => {
    for (const m of [admin, member])
      submitMonthlyEffort(db, { ...input, memberId: m.id });
  };
  const confirm = () => {
    startMonthlyEffortReview(db, input);
    confirmMonthlyEffortClose(db, input);
  };
  return { db, sqlite, admin, member, project, input, submit, confirm };
}

test("zero-hour submissions confirm without plans, capacity, or financial data", () => {
  const { db, input, submit, confirm } = setup();
  expect(getMonthlyPeriodState(db, month)).toMatchObject({
    effortStatus: "open",
    costStatus: "open",
    isProtected: false,
  });
  expect(getMonthlyEffortCompleteness(db, month).blockers).toHaveLength(2);
  expect(() => startMonthlyEffortReview(db, input)).toThrow("未提出");
  expect(getMonthlyPeriodState(db, month).close).toBeUndefined();
  submit();
  confirm();
  const state = getMonthlyPeriodState(db, month);
  expect(state).toMatchObject({
    effortStatus: "confirmed",
    costStatus: "open",
    isProtected: true,
    label: "工数確定済み",
  });
  expect(getMonthlyCostCloseState(db, month)).toMatchObject({
    status: "open",
    label: "原価未確認",
    isProtected: false,
  });
  expect(listMonthlyCostCloseProjectSnapshots(db, state.close!.id)).toEqual([]);
  expect(() => requireOpenMonth(db, month)).toThrow();
});

test("time-only activity confirms despite missing rates and billable baselines", () => {
  const { db, member, input, submit, confirm } = setup();
  const project = createProject(db, {
    code: "B",
    name: "受託案件",
    projectType: "billable",
  });
  const log = createDailyWorkLog(db, {
    memberId: member.id,
    workDate: month + "-10",
    totalWorkingHours: 8,
  });
  createEffortAllocation(db, {
    dailyWorkLogId: log.id,
    memberId: member.id,
    projectId: project.id,
    allocatedHours: 8,
  });
  submit();
  confirm();
  expect(getMonthlyEffortCompleteness(db, month).blockers).toEqual([]);
  expect(getMonthlyCostCompleteness(db, month).blockers).toHaveLength(3);
  expect(() => startMonthlyCostReview(db, input)).toThrow("ブロッカー");
  expect(listProjectFinancialReview(db, { month })[0].source).not.toBe(
    "approved_snapshot",
  );
});

test("fresh checks report member/date links and refuse confirmation after new imbalance", () => {
  const { db, member, project, input, submit } = setup();
  const workDate = month + "-12";
  const log = createDailyWorkLog(db, {
    memberId: member.id,
    workDate,
    totalWorkingHours: 8,
  });
  createEffortAllocation(db, {
    dailyWorkLogId: log.id,
    memberId: member.id,
    projectId: project.id,
    allocatedHours: 8,
  });
  submit();
  startMonthlyEffortReview(db, input);
  const before = listMonthlyCostCloseEvents(
    db,
    getMonthlyPeriodState(db, month).close!.id,
  );
  updateDailyWorkLog(db, log.id, { totalWorkingHours: 9 });
  expect(getMonthlyEffortCompleteness(db, month).blockers).toEqual([
    expect.objectContaining({
      code: "UNBALANCED_WORK_LOG",
      memberId: member.id,
      workDate,
      href: `/work-logs/${workDate}?memberId=${member.id}`,
    }),
  ]);
  expect(() => confirmMonthlyEffortClose(db, input)).toThrow("配賦不一致");
  expect(getMonthlyPeriodState(db, month).effortStatus).toBe("in_review");
  expect(
    listMonthlyCostCloseEvents(db, getMonthlyPeriodState(db, month).close!.id),
  ).toEqual(before);
});

test("invalid transitions, malformed months, non-admins and inactive admins do not persist changes", () => {
  const { db, input, admin, member, submit } = setup();
  submit();
  expect(() => confirmMonthlyEffortClose(db, input)).toThrow("状態");
  for (const value of ["2026-13", "0000-01", "no-month"]) {
    expect(() =>
      startMonthlyEffortReview(db, { ...input, month: value }),
    ).toThrow("対象月");
  }
  const operations = [
    () => startMonthlyEffortReview(db, { ...input, actorMemberId: member.id }),
    () => confirmMonthlyEffortClose(db, { ...input, actorMemberId: member.id }),
    () => startMonthlyCostReview(db, { ...input, actorMemberId: member.id }),
    () => approveMonthlyCostClose(db, { ...input, actorMemberId: member.id }),
    () =>
      reopenMonthlyCostClose(db, {
        ...input,
        actorMemberId: member.id,
        reason: "test",
      }),
  ];
  for (const operation of operations) {
    try {
      operation();
      throw new Error("must reject");
    } catch (error) {
      expect(error).toMatchObject({ status: 403 });
    }
  }
  updateMember(db, admin.id, { isActive: false });
  expect(() => startMonthlyEffortReview(db, input)).toThrow();
  expect(getMonthlyPeriodState(db, month).close).toBeUndefined();
});

test.each(["review", "confirm", "reopen"] as const)(
  "%s rolls state back if history cannot be saved",
  (operation) => {
    const { db, sqlite, input, submit } = setup();
    submit();
    if (operation !== "review") startMonthlyEffortReview(db, input);
    const before = getMonthlyPeriodState(db, month);
    sqlite.exec(
      "CREATE TRIGGER reject_event BEFORE INSERT ON monthly_cost_close_events BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    );
    expect(() =>
      operation === "review"
        ? startMonthlyEffortReview(db, input)
        : operation === "confirm"
          ? confirmMonthlyEffortClose(db, input)
          : reopenMonthlyCostClose(db, { ...input, reason: "修正" }),
    ).toThrow("event rejected");
    expect(getMonthlyPeriodState(db, month)).toEqual(before);
  },
);

test("missing-cost correction preserves effort, submissions and planning confirmation", () => {
  const { db, member, project, input, submit, confirm } = setup();
  const plan = createMonthlyPlan(db, {
    memberId: member.id,
    projectId: project.id,
    month,
    plannedHours: 8,
  });
  const review = findMonthlyPlanReview(db, member.id, month)!;
  confirmMonthlyPlan(db, {
    ...input,
    memberId: member.id,
    revision: review.revision,
  });
  const beforeReview = findMonthlyPlanReview(db, member.id, month);
  submit();
  confirm();
  const submission = findMonthlyEffortSubmission(db, member.id, month);
  const beforeClose = getMonthlyPeriodState(db, month).close!;
  const correction = {
    ...input,
    targetType: "monthly_plan" as const,
    targetId: plan.id,
    hourlyCostRate: 0,
    reason: "明示的な0円",
  };
  expect(() =>
    correctMissingHourlyCostSnapshot(db, {
      ...correction,
      actorMemberId: member.id,
    }),
  ).toThrow();
  for (const rate of [NaN, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() =>
      correctMissingHourlyCostSnapshot(db, {
        ...correction,
        hourlyCostRate: rate,
      }),
    ).toThrow("時間単価");
  }
  expect(() =>
    correctMissingHourlyCostSnapshot(db, { ...correction, reason: " " }),
  ).toThrow("理由");
  correctMissingHourlyCostSnapshot(db, correction);
  expect(findMonthlyPlanById(db, plan.id)).toMatchObject({
    plannedHours: 8,
    hourlyCostRateSnapshot: 0,
  });
  expect(findMonthlyPlanReview(db, member.id, month)).toEqual(beforeReview);
  expect(findMonthlyEffortSubmission(db, member.id, month)).toEqual(submission);
  expect(getMonthlyPeriodState(db, month).close).toEqual(beforeClose);
  expect(listMonthlyCostCloseProjectSnapshots(db, beforeClose.id)).toEqual([]);
  expect(() => correctMissingHourlyCostSnapshot(db, correction)).toThrow(
    "すでに",
  );
  expect(() =>
    submitMonthlyEffort(db, { ...input, memberId: member.id }),
  ).toThrow();
  expect(() =>
    confirmMonthlyPlan(db, {
      ...input,
      memberId: member.id,
      revision: review.revision,
    }),
  ).toThrow();
  startMonthlyCostReview(db, input);
  approveMonthlyCostClose(db, input);
  const snapshots = listMonthlyCostCloseProjectSnapshots(db, beforeClose.id);
  expect(snapshots).toHaveLength(1);
  expect(() => reopenMonthlyCostClose(db, { ...input, reason: "" })).toThrow(
    "理由",
  );
  reopenMonthlyCostClose(db, { ...input, reason: "時間修正" });
  expect(getMonthlyPeriodState(db, month)).toMatchObject({
    effortStatus: "open",
    costStatus: "open",
    isProtected: false,
  });
  expect(findMonthlyEffortSubmission(db, member.id, month)).toEqual(submission);
  expect(listMonthlyCostCloseProjectSnapshots(db, beforeClose.id)).toEqual(
    snapshots,
  );
  expect(listMonthlyCostCloseEvents(db, beforeClose.id).at(-1)).toMatchObject({
    previousEffortStatus: "confirmed",
    nextEffortStatus: "open",
    previousStatus: "approved",
    nextStatus: "open",
    reason: "時間修正",
  });
  expect(listProjectFinancialReview(db, { month })[0].source).not.toBe(
    "approved_snapshot",
  );
});

test.each(["in_review", "approved"] as const)(
  "correction cannot bypass a %s source month by choosing a later month",
  (status) => {
    const { db, member, project, input, submit, confirm } = setup();
    const log = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-06-10",
      totalWorkingHours: 8,
    });
    const allocation = createEffortAllocation(db, {
      dailyWorkLogId: log.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 8,
    });
    submit();
    confirm();
    const source = getOrCreateMonthlyCostClose(db, "2026-06");
    updateMonthlyCostClose(db, source.id, { status, updatedAt: "2026-07-01" });
    const correction = {
      ...input,
      targetType: "effort_allocation" as const,
      targetId: allocation.id,
      hourlyCostRate: 1000,
      reason: "補正",
    };
    expect(() => correctMissingHourlyCostSnapshot(db, correction)).toThrow();
    expect(findAllocationById(db, allocation.id)).toEqual(allocation);
    updateMonthlyCostClose(db, source.id, {
      status: "open",
      effortStatus: "confirmed",
      updatedAt: "2026-07-01",
    });
    correctMissingHourlyCostSnapshot(db, correction);
    expect(findAllocationById(db, allocation.id)).toMatchObject({
      allocatedHours: 8,
      hourlyCostRateSnapshot: 1000,
    });
    expect(getMonthlyPeriodState(db, "2026-06").effortStatus).toBe("confirmed");
  },
);

test("migrated cost review needs explicit effort confirmation before approval", () => {
  const { db, input, submit } = setup();
  submit();
  const close = getOrCreateMonthlyCostClose(db, month);
  updateMonthlyCostClose(db, close.id, {
    status: "in_review",
    effortStatus: "in_review",
    updatedAt: "2026-08-01",
  });
  expect(() => approveMonthlyCostClose(db, input)).toThrow("工数を確定");
  confirmMonthlyEffortClose(db, input);
  approveMonthlyCostClose(db, input);
  expect(getMonthlyPeriodState(db, month)).toMatchObject({
    effortStatus: "confirmed",
    costStatus: "approved",
  });
});

test.each(["in_review", "approved"] as const)(
  "cost-only %s still protects normal writers and missing-cost correction",
  (status) => {
    const { db, member, project, input } = setup();
    const plan = createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month,
      plannedHours: 8,
    });
    const close = getOrCreateMonthlyCostClose(db, month);
    updateMonthlyCostClose(db, close.id, { status, updatedAt: "2026-08-01" });
    expect(getMonthlyPeriodState(db, month).isProtected).toBe(true);
    expect(() => requireOpenMonth(db, month)).toThrow();
    expect(() =>
      correctMissingHourlyCostSnapshot(db, {
        ...input,
        targetType: "monthly_plan",
        targetId: plan.id,
        hourlyCostRate: 1000,
        reason: "補正",
      }),
    ).toThrow();
    expect(findMonthlyPlanById(db, plan.id)?.hourlyCostRateSnapshot).toBeNull();
  },
);
