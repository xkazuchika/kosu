import type { KosuDatabase } from "~/db/client";
import { findDailyWorkLogById } from "~/db/repositories/daily-work-logs";
import { findAllocationById, updateEffortAllocation } from "~/db/repositories/effort-allocations";
import {
  appendMonthlyCostCloseEvent,
  findMonthlyCostCloseByMonth,
  getOrCreateMonthlyCostClose,
  updateMonthlyCostClose,
  type MonthlyCostCloseStatus,
} from "~/db/repositories/monthly-cost-closes";
import { findMonthlyPlanById, updateMonthlyPlan } from "~/db/repositories/monthly-plans";

export const monthlyCostCloseStatusLabels: Record<MonthlyCostCloseStatus, string> = {
  open: "未締め",
  in_review: "レビュー中",
  approved: "承認済み",
};

export function validateMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("対象月は YYYY-MM 形式で指定してください。");
  }
}

export function getMonthFromDate(date: string) {
  const month = date.slice(0, 7);
  validateMonth(month);
  return month;
}

export function getMonthlyCostCloseState(db: KosuDatabase, month: string) {
  validateMonth(month);
  const close = findMonthlyCostCloseByMonth(db, month);

  return {
    close,
    month,
    status: close?.status ?? ("open" as const),
    label: monthlyCostCloseStatusLabels[close?.status ?? "open"],
    isProtected: close?.status === "in_review" || close?.status === "approved",
  };
}

export function requireOpenMonth(db: KosuDatabase, month: string) {
  const state = getMonthlyCostCloseState(db, month);

  if (state.isProtected) {
    throw new Response(
      `${month} は「${state.label}」のため変更できません。月次締め画面で理由を記録して再オープンしてください。`,
      { status: 423 },
    );
  }

  return state;
}

export function startMonthlyCostReview(
  db: KosuDatabase,
  input: { month: string; actorMemberId: string; occurredAt?: string },
) {
  validateMonth(input.month);
  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    const close = getOrCreateMonthlyCostClose(tx, input.month);

    if (close.status !== "open") {
      throw new Error(`${input.month} は未締めではないため、レビューを開始できません。`);
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const updated = updateMonthlyCostClose(tx, close.id, {
      status: "in_review",
      enteredReviewByMemberId: input.actorMemberId,
      enteredReviewAt: occurredAt,
      approvedByMemberId: null,
      approvedAt: null,
      updatedAt: occurredAt,
    });
    appendMonthlyCostCloseEvent(tx, {
      closeId: close.id,
      eventType: "entered_review",
      actorMemberId: input.actorMemberId,
      previousStatus: "open",
      nextStatus: "in_review",
      occurredAt,
    });

    return updated;
  });
}

export function reopenMonthlyCostClose(
  db: KosuDatabase,
  input: { month: string; actorMemberId: string; reason: string; occurredAt?: string },
) {
  validateMonth(input.month);
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("再オープン理由を入力してください。");
  }

  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    const close = findMonthlyCostCloseByMonth(tx, input.month);

    if (!close || close.status === "open") {
      throw new Error(`${input.month} は保護されていないため、再オープンできません。`);
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const previousStatus = close.status;
    const updated = updateMonthlyCostClose(tx, close.id, {
      status: "open",
      enteredReviewByMemberId: null,
      enteredReviewAt: null,
      approvedByMemberId: null,
      approvedAt: null,
      updatedAt: occurredAt,
    });
    appendMonthlyCostCloseEvent(tx, {
      closeId: close.id,
      eventType: "reopened",
      actorMemberId: input.actorMemberId,
      previousStatus,
      nextStatus: "open",
      reason,
      occurredAt,
    });

    return updated;
  });
}

export function correctMissingHourlyCostSnapshot(
  db: KosuDatabase,
  input: {
    month: string;
    actorMemberId: string;
    targetType: "monthly_plan" | "effort_allocation";
    targetId: string;
    hourlyCostRate: number;
    reason: string;
    occurredAt?: string;
  },
) {
  validateMonth(input.month);
  const reason = input.reason.trim();

  if (!Number.isInteger(input.hourlyCostRate) || input.hourlyCostRate < 0) {
    throw new Error("時間単価は0以上の整数で入力してください。");
  }
  if (!reason) {
    throw new Error("原価補正の理由を入力してください。");
  }
  if (input.targetType !== "monthly_plan" && input.targetType !== "effort_allocation") {
    throw new Error("原価補正の対象種別が不正です。");
  }

  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    requireOpenMonth(tx, input.month);
    const close = getOrCreateMonthlyCostClose(tx, input.month);
    let previousHourlyCostRate: number | null;

    if (input.targetType === "monthly_plan") {
      const plan = findMonthlyPlanById(tx, input.targetId);

      if (!plan || plan.month !== input.month) {
        throw new Error("対象月の月次予定が見つかりません。");
      }
      if (plan.hourlyCostRateSnapshot !== null) {
        throw new Error("対象の月次予定にはすでに原価が設定されています。");
      }

      previousHourlyCostRate = plan.hourlyCostRateSnapshot;
      updateMonthlyPlan(tx, plan.id, { hourlyCostRateSnapshot: input.hourlyCostRate });
    } else {
      const allocation = findAllocationById(tx, input.targetId);
      const workLog = allocation ? findDailyWorkLogById(tx, allocation.dailyWorkLogId) : undefined;

      if (!allocation || allocation.deletedAt || !workLog || workLog.deletedAt || workLog.workDate > `${input.month}-31`) {
        throw new Error("対象月以前の実績配賦が見つかりません。");
      }
      if (allocation.hourlyCostRateSnapshot !== null) {
        throw new Error("対象の実績配賦にはすでに原価が設定されています。");
      }

      previousHourlyCostRate = allocation.hourlyCostRateSnapshot;
      updateEffortAllocation(tx, allocation.id, { hourlyCostRateSnapshot: input.hourlyCostRate });
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    appendMonthlyCostCloseEvent(tx, {
      closeId: close.id,
      eventType: "cost_snapshot_corrected",
      actorMemberId: input.actorMemberId,
      previousStatus: "open",
      nextStatus: "open",
      reason,
      targetType: input.targetType,
      targetId: input.targetId,
      previousHourlyCostRate,
      nextHourlyCostRate: input.hourlyCostRate,
      occurredAt,
    });

    return input.hourlyCostRate;
  });
}
