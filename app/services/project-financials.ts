import type { KosuDatabase } from "~/db/client";
import { listEffortReportRows } from "~/db/repositories/effort-allocations";
import { listMonthlyPlansByMonth } from "~/db/repositories/monthly-plans";
import { listProjects } from "~/db/repositories/projects";

type CostSummary = {
  knownCost: number;
  missingCostHours: number;
  missingCostRows: number;
};

export type ProjectFinancialReviewRow = {
  contractRevenueAmount: number | null;
  cumulativeActual: CostSummary;
  finalLaborGrossProfit: number | null;
  finalLaborGrossProfitRate: number | null;
  laborBudgetConsumption: number | null;
  laborCostBudgetAmount: number | null;
  legacyRevenueOrBudgetAmount: number | null;
  monthlyActual: CostSummary;
  monthlyPlanned: CostSummary;
  project: ReturnType<typeof listProjects>[number];
  remainingLaborCostBudget: number | null;
  targetLaborGrossProfit: number | null;
  targetLaborGrossProfitRate: number | null;
};

function createCostSummary(): CostSummary {
  return { knownCost: 0, missingCostHours: 0, missingCostRows: 0 };
}

function addCost(summary: CostSummary, hours: number, hourlyCostRateSnapshot: number | null) {
  if (hourlyCostRateSnapshot === null) {
    summary.missingCostHours += hours;
    summary.missingCostRows += 1;
    return;
  }

  summary.knownCost += hours * hourlyCostRateSnapshot;
}

function finalizeCostSummary(summary: CostSummary): CostSummary {
  return { ...summary, knownCost: Math.round(summary.knownCost) };
}

function isComplete(summary: CostSummary) {
  return summary.missingCostRows === 0;
}

export function listProjectFinancialReview(
  db: KosuDatabase,
  { month, projectId }: { month: string; projectId?: string },
): ProjectFinancialReviewRow[] {
  const projects = listProjects(db).filter((project) => !projectId || project.id === projectId);
  const monthlyPlans = listMonthlyPlansByMonth(db, month);
  const monthlyActuals = listEffortReportRows(db, { month });
  const cumulativeActuals = listEffortReportRows(db, {});
  const monthlyPlannedByProject = new Map<string, CostSummary>();
  const monthlyActualByProject = new Map<string, CostSummary>();
  const cumulativeActualByProject = new Map<string, CostSummary>();

  for (const plan of monthlyPlans) {
    const summary = monthlyPlannedByProject.get(plan.projectId) ?? createCostSummary();
    addCost(summary, plan.plannedHours, plan.hourlyCostRateSnapshot);
    monthlyPlannedByProject.set(plan.projectId, summary);
  }

  for (const allocation of monthlyActuals) {
    const summary = monthlyActualByProject.get(allocation.projectId) ?? createCostSummary();
    addCost(summary, allocation.allocatedHours, allocation.hourlyCostRateSnapshot);
    monthlyActualByProject.set(allocation.projectId, summary);
  }

  for (const allocation of cumulativeActuals) {
    const summary = cumulativeActualByProject.get(allocation.projectId) ?? createCostSummary();
    addCost(summary, allocation.allocatedHours, allocation.hourlyCostRateSnapshot);
    cumulativeActualByProject.set(allocation.projectId, summary);
  }

  return projects.map((project) => {
    const monthlyPlanned = finalizeCostSummary(monthlyPlannedByProject.get(project.id) ?? createCostSummary());
    const monthlyActual = finalizeCostSummary(monthlyActualByProject.get(project.id) ?? createCostSummary());
    const cumulativeActual = finalizeCostSummary(cumulativeActualByProject.get(project.id) ?? createCostSummary());
    const actualCostComplete = isComplete(cumulativeActual);
    const laborCostBudgetAmount = project.laborCostBudgetAmount;
    const contractRevenueAmount = project.contractRevenueAmount;
    const remainingLaborCostBudget = laborCostBudgetAmount !== null && actualCostComplete
      ? laborCostBudgetAmount - cumulativeActual.knownCost
      : null;
    const laborBudgetConsumption = laborCostBudgetAmount !== null && laborCostBudgetAmount > 0 && actualCostComplete
      ? cumulativeActual.knownCost / laborCostBudgetAmount
      : null;
    const targetLaborGrossProfit = contractRevenueAmount !== null && laborCostBudgetAmount !== null
      ? contractRevenueAmount - laborCostBudgetAmount
      : null;
    const targetLaborGrossProfitRate = contractRevenueAmount !== null && contractRevenueAmount > 0 && targetLaborGrossProfit !== null
      ? targetLaborGrossProfit / contractRevenueAmount
      : null;
    const finalLaborGrossProfit = project.isArchived && contractRevenueAmount !== null && actualCostComplete
      ? contractRevenueAmount - cumulativeActual.knownCost
      : null;
    const finalLaborGrossProfitRate = project.isArchived && contractRevenueAmount !== null && contractRevenueAmount > 0 && finalLaborGrossProfit !== null
      ? finalLaborGrossProfit / contractRevenueAmount
      : null;

    return {
      project,
      contractRevenueAmount,
      laborCostBudgetAmount,
      legacyRevenueOrBudgetAmount: project.revenueOrBudgetAmount,
      monthlyPlanned,
      monthlyActual,
      cumulativeActual,
      remainingLaborCostBudget,
      laborBudgetConsumption,
      targetLaborGrossProfit,
      targetLaborGrossProfitRate,
      finalLaborGrossProfit,
      finalLaborGrossProfitRate,
    };
  });
}
