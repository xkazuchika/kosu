import type { KosuDatabase } from "~/db/client";
import { listDailyAllocationPlansByMonth } from "~/db/repositories/daily-allocation-plans";
import { listDailyWorkLogsByMonth } from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog, listEffortReportRows } from "~/db/repositories/effort-allocations";
import { listMembers } from "~/db/repositories/members";
import { listMonthlyPlansByMonth } from "~/db/repositories/monthly-plans";
import { listProjects } from "~/db/repositories/projects";
import { validateMonth } from "~/services/monthly-cost-close";

export type MonthlyCostBlockingIssueCode =
  | "UNBALANCED_WORK_LOG"
  | "MISSING_MONTHLY_PLAN_COST"
  | "MISSING_MONTHLY_ALLOCATION_COST"
  | "MISSING_HISTORICAL_ALLOCATION_COST"
  | "MISSING_BILLABLE_CONTRACT_REVENUE"
  | "MISSING_BILLABLE_LABOR_BUDGET";

export type MonthlyCostWarningCode = "DAILY_MONTHLY_PLAN_MISMATCH";

export type MonthlyCostIssue = {
  code: MonthlyCostBlockingIssueCode | MonthlyCostWarningCode;
  severity: "blocking" | "warning";
  key: string;
  title: string;
  detail: string;
  href: string;
  memberId?: string;
  projectId?: string;
  workDate?: string;
  correction?: {
    targetType: "monthly_plan" | "effort_allocation";
    targetId: string;
  };
};

export type MonthlyCostCompleteness = {
  blockers: MonthlyCostIssue[];
  warnings: MonthlyCostIssue[];
};

const epsilon = 0.0001;

export function getMonthlyCostCompleteness(db: KosuDatabase, month: string): MonthlyCostCompleteness {
  validateMonth(month);
  const blockers: MonthlyCostIssue[] = [];
  const warnings: MonthlyCostIssue[] = [];
  const members = listMembers(db);
  const projects = listProjects(db);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const workLogs = listDailyWorkLogsByMonth(db, month);
  const monthlyPlans = listMonthlyPlansByMonth(db, month);
  const monthlyActuals = listEffortReportRows(db, { month });
  const historicalActuals = listEffortReportRows(db, { endDate: `${month}-01` })
    .filter((allocation) => allocation.workDate < `${month}-01`);

  for (const workLog of workLogs) {
    const allocatedHours = listAllocationsByWorkLog(db, workLog.id)
      .reduce((total, allocation) => total + allocation.allocatedHours, 0);

    if (Math.abs(allocatedHours - workLog.totalWorkingHours) <= epsilon) {
      continue;
    }

    const member = memberById.get(workLog.memberId);
    blockers.push({
      code: "UNBALANCED_WORK_LOG",
      severity: "blocking",
      key: `UNBALANCED_WORK_LOG:${workLog.id}`,
      title: "勤務時間と配賦時間が一致していません",
      detail: `${member?.displayName ?? workLog.memberId} / ${workLog.workDate}: 勤務 ${workLog.totalWorkingHours}h、配賦 ${allocatedHours}h`,
      href: `/work-logs/${workLog.workDate}?memberId=${workLog.memberId}`,
      memberId: workLog.memberId,
      workDate: workLog.workDate,
    });
  }

  for (const plan of monthlyPlans) {
    if (plan.plannedHours <= 0 || plan.hourlyCostRateSnapshot !== null) {
      continue;
    }

    const member = memberById.get(plan.memberId);
    const project = projectById.get(plan.projectId);
    blockers.push({
      code: "MISSING_MONTHLY_PLAN_COST",
      severity: "blocking",
      key: `MISSING_MONTHLY_PLAN_COST:${plan.id}`,
      title: "月次予定の原価が未設定です",
      detail: `${member?.displayName ?? plan.memberId} / ${project?.code ?? plan.projectId}: ${plan.plannedHours}h`,
      href: `/monthly-plans/admin?month=${month}`,
      memberId: plan.memberId,
      projectId: plan.projectId,
      correction: { targetType: "monthly_plan", targetId: plan.id },
    });
  }

  for (const allocation of monthlyActuals) {
    if (allocation.allocatedHours <= 0 || allocation.hourlyCostRateSnapshot !== null) {
      continue;
    }

    blockers.push({
      code: "MISSING_MONTHLY_ALLOCATION_COST",
      severity: "blocking",
      key: `MISSING_MONTHLY_ALLOCATION_COST:${allocation.allocationId}`,
      title: "当月実績の原価が未設定です",
      detail: `${allocation.memberName} / ${allocation.workDate} / ${allocation.projectCode}: ${allocation.allocatedHours}h`,
      href: `/work-logs/${allocation.workDate}?memberId=${allocation.memberId}`,
      memberId: allocation.memberId,
      projectId: allocation.projectId,
      workDate: allocation.workDate,
      correction: { targetType: "effort_allocation", targetId: allocation.allocationId },
    });
  }

  for (const allocation of historicalActuals) {
    if (allocation.allocatedHours <= 0 || allocation.hourlyCostRateSnapshot !== null) {
      continue;
    }

    blockers.push({
      code: "MISSING_HISTORICAL_ALLOCATION_COST",
      severity: "blocking",
      key: `MISSING_HISTORICAL_ALLOCATION_COST:${allocation.allocationId}`,
      title: "累計実績の原価が未設定です",
      detail: `${allocation.memberName} / ${allocation.workDate} / ${allocation.projectCode}: ${allocation.allocatedHours}h`,
      href: `/work-logs/${allocation.workDate}?memberId=${allocation.memberId}`,
      memberId: allocation.memberId,
      projectId: allocation.projectId,
      workDate: allocation.workDate,
      correction: { targetType: "effort_allocation", targetId: allocation.allocationId },
    });
  }

  const activeProjectIds = new Set<string>();
  for (const plan of monthlyPlans) {
    if (plan.plannedHours > epsilon) activeProjectIds.add(plan.projectId);
  }
  for (const allocation of monthlyActuals) {
    if (allocation.allocatedHours > epsilon) activeProjectIds.add(allocation.projectId);
  }

  for (const project of projects) {
    if (project.projectType !== "billable" || !activeProjectIds.has(project.id)) {
      continue;
    }

    if (project.contractRevenueAmount === null) {
      blockers.push({
        code: "MISSING_BILLABLE_CONTRACT_REVENUE",
        severity: "blocking",
        key: `MISSING_BILLABLE_CONTRACT_REVENUE:${project.id}`,
        title: "請求対象案件の契約売上が未設定です",
        detail: `${project.code} ${project.name}`,
        href: `/projects/${project.id}`,
        projectId: project.id,
      });
    }
    if (project.laborCostBudgetAmount === null) {
      blockers.push({
        code: "MISSING_BILLABLE_LABOR_BUDGET",
        severity: "blocking",
        key: `MISSING_BILLABLE_LABOR_BUDGET:${project.id}`,
        title: "請求対象案件の人件費予算が未設定です",
        detail: `${project.code} ${project.name}`,
        href: `/projects/${project.id}`,
        projectId: project.id,
      });
    }
  }

  const monthlyPlanHours = aggregateHours(monthlyPlans, (plan) => `${plan.memberId}:${plan.projectId}`, "plannedHours");
  const dailyPlanHours = aggregateHours(
    listDailyAllocationPlansByMonth(db, month),
    (plan) => `${plan.memberId}:${plan.projectId}`,
    "plannedHours",
  );
  const planKeys = new Set([...monthlyPlanHours.keys(), ...dailyPlanHours.keys()]);

  for (const key of planKeys) {
    const monthlyHours = monthlyPlanHours.get(key) ?? 0;
    const dailyHours = dailyPlanHours.get(key) ?? 0;

    if (Math.abs(monthlyHours - dailyHours) <= epsilon || (monthlyHours <= epsilon && dailyHours <= epsilon)) {
      continue;
    }

    const [memberId, projectId] = key.split(":");
    warnings.push({
      code: "DAILY_MONTHLY_PLAN_MISMATCH",
      severity: "warning",
      key: `DAILY_MONTHLY_PLAN_MISMATCH:${key}`,
      title: "日次予定と月次予定が一致していません",
      detail: `${memberById.get(memberId)?.displayName ?? memberId} / ${projectById.get(projectId)?.code ?? projectId}: 日次 ${dailyHours}h、月次 ${monthlyHours}h`,
      href: `/daily-plans?month=${month}`,
      memberId,
      projectId,
    });
  }

  return { blockers, warnings };
}

function aggregateHours<T extends Record<string, unknown>>(
  rows: T[],
  keyFor: (row: T) => string,
  hoursKey: keyof T,
) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const hours = Number(row[hoursKey]);
    totals.set(keyFor(row), (totals.get(keyFor(row)) ?? 0) + hours);
  }

  return totals;
}
