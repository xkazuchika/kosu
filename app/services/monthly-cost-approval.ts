import type { KosuDatabase } from "~/db/client";
import { listEffortReportRows } from "~/db/repositories/effort-allocations";
import {
  appendMonthlyCostCloseEvent,
  createMonthlyCostCloseProjectSnapshot,
  deleteMonthlyCostCloseProjectSnapshots,
  findMonthlyCostCloseByMonth,
  updateMonthlyCostClose,
} from "~/db/repositories/monthly-cost-closes";
import { listMonthlyPlansByMonth } from "~/db/repositories/monthly-plans";
import { getMonthlyCostCompleteness } from "~/services/monthly-cost-completeness";
import { validateMonth } from "~/services/monthly-cost-close";
import { listProjectFinancialReview } from "~/services/project-financials";

export function approveMonthlyCostClose(
  db: KosuDatabase,
  input: { month: string; actorMemberId: string; occurredAt?: string },
) {
  validateMonth(input.month);

  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    const close = findMonthlyCostCloseByMonth(tx, input.month);

    if (!close || close.status !== "in_review") {
      throw new Error(`${input.month} はレビュー中ではないため承認できません。`);
    }

    const completeness = getMonthlyCostCompleteness(tx, input.month);

    if (completeness.blockers.length > 0) {
      throw new Error(`未解決のブロッカーが ${completeness.blockers.length} 件あるため承認できません。`);
    }

    const activeProjectIds = new Set<string>();
    for (const plan of listMonthlyPlansByMonth(tx, input.month)) {
      if (plan.plannedHours > 0) activeProjectIds.add(plan.projectId);
    }
    for (const allocation of listEffortReportRows(tx, { endDate: `${input.month}-31` })) {
      if (allocation.allocatedHours > 0) activeProjectIds.add(allocation.projectId);
    }

    const rows = listProjectFinancialReview(tx, { month: input.month }).filter(
      (row) =>
        activeProjectIds.has(row.project.id) ||
        row.contractRevenueAmount !== null ||
        row.laborCostBudgetAmount !== null ||
        row.legacyRevenueOrBudgetAmount !== null,
    );

    deleteMonthlyCostCloseProjectSnapshots(tx, close.id);
    for (const row of rows) {
      createMonthlyCostCloseProjectSnapshot(tx, {
        closeId: close.id,
        projectId: row.project.id,
        projectCode: row.project.code,
        projectName: row.project.name,
        projectType: row.project.projectType,
        projectIsArchived: row.project.isArchived,
        legacyRevenueOrBudgetAmount: row.legacyRevenueOrBudgetAmount,
        contractRevenueAmount: row.contractRevenueAmount,
        laborCostBudgetAmount: row.laborCostBudgetAmount,
        monthlyPlannedCost: row.monthlyPlanned.knownCost,
        monthlyActualCost: row.monthlyActual.knownCost,
        cumulativeActualCost: row.cumulativeActual.knownCost,
        remainingLaborCostBudget: row.remainingLaborCostBudget,
        laborBudgetConsumption: row.laborBudgetConsumption,
        targetLaborGrossProfit: row.targetLaborGrossProfit,
        targetLaborGrossProfitRate: row.targetLaborGrossProfitRate,
        finalLaborGrossProfit: row.finalLaborGrossProfit,
        finalLaborGrossProfitRate: row.finalLaborGrossProfitRate,
      });
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    appendMonthlyCostCloseEvent(tx, {
      closeId: close.id,
      eventType: "approved",
      actorMemberId: input.actorMemberId,
      previousStatus: "in_review",
      nextStatus: "approved",
      occurredAt,
    });
    updateMonthlyCostClose(tx, close.id, {
      status: "approved",
      approvedByMemberId: input.actorMemberId,
      approvedAt: occurredAt,
      updatedAt: occurredAt,
    });

    return { closeId: close.id, projectSnapshotCount: rows.length };
  });
}
