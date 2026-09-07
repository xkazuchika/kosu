import type { KosuDatabase } from "~/db/client";
import { listEffortReportRows } from "~/db/repositories/effort-allocations";
import { listMonthlyPlansByProject } from "~/db/repositories/monthly-plans";
import { findProjectById } from "~/db/repositories/projects";
import { listMonthlyPlansByMemberAndMonth } from "~/db/repositories/monthly-plans";

export type ProjectEffortOverview = {
  effortBudgetHours: number | null;
  plannedHours: number;
  actualHours: number;
  unallocatedHours: number | null;
  remainingHours: number | null;
  consumptionRate: number | null;
  isOverPlanned: boolean;
  isOverActual: boolean;
};

export function getProjectEffortOverview(
  db: KosuDatabase,
  projectId: string,
): ProjectEffortOverview {
  const project = findProjectById(db, projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const plannedHours = listMonthlyPlansByProject(db, projectId).reduce(
    (sum, plan) => sum + plan.plannedHours,
    0,
  );
  const actualHours = listEffortReportRows(db, { projectId }).reduce(
    (sum, row) => sum + row.allocatedHours,
    0,
  );
  const effortBudgetHours = project.effortBudgetHours;

  return {
    effortBudgetHours,
    plannedHours,
    actualHours,
    unallocatedHours:
      effortBudgetHours === null ? null : effortBudgetHours - plannedHours,
    remainingHours:
      effortBudgetHours === null ? null : effortBudgetHours - actualHours,
    consumptionRate:
      effortBudgetHours !== null && effortBudgetHours > 0
        ? actualHours / effortBudgetHours
        : null,
    isOverPlanned:
      effortBudgetHours !== null && plannedHours > effortBudgetHours,
    isOverActual: effortBudgetHours !== null && actualHours > effortBudgetHours,
  };
}

export function getMemberProjectEffortContext(
  db: KosuDatabase,
  memberId: string,
  month: string,
) {
  const result = new Map<
    string,
    { plannedHours: number; actualHours: number; balanceHours: number }
  >();
  for (const plan of listMonthlyPlansByMemberAndMonth(db, memberId, month)) {
    const current = result.get(plan.projectId) ?? {
      plannedHours: 0,
      actualHours: 0,
      balanceHours: 0,
    };
    current.plannedHours += plan.plannedHours;
    result.set(plan.projectId, current);
  }
  for (const row of listEffortReportRows(db, { memberId, month })) {
    const current = result.get(row.projectId) ?? {
      plannedHours: 0,
      actualHours: 0,
      balanceHours: 0,
    };
    current.actualHours += row.allocatedHours;
    result.set(row.projectId, current);
  }
  for (const current of result.values())
    current.balanceHours = current.plannedHours - current.actualHours;
  return result;
}
