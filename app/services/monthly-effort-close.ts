import type { KosuDatabase } from "~/db/client";
import { findMemberById } from "~/db/repositories/members";
import {
  appendMonthlyCostCloseEvent,
  getOrCreateMonthlyCostClose,
  updateMonthlyCostClose,
} from "~/db/repositories/monthly-cost-closes";
import { validateMonth } from "./monthly-cost-close";
import { getMonthlyEffortCompleteness } from "./monthly-effort-completeness";

export function requireCloseAdministrator(db: KosuDatabase, memberId: string) {
  const actor = findMemberById(db, memberId);
  if (!actor?.isActive || actor.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
}

function transitionEffort(
  db: KosuDatabase,
  input: {
    month: string;
    actorMemberId: string;
    occurredAt?: string;
  },
  nextStatus: "in_review" | "confirmed",
) {
  validateMonth(input.month);
  return db.transaction(
    (transaction) => {
      const tx = transaction as unknown as KosuDatabase;
      requireCloseAdministrator(tx, input.actorMemberId);
      const close = getOrCreateMonthlyCostClose(tx, input.month);
      const expected = nextStatus === "in_review" ? "open" : "in_review";
      if (
        close.effortStatus !== expected ||
        (nextStatus === "in_review" && close.status !== "open")
      ) {
        throw new Error(
          "工数の状態が変わっています。画面を再表示して確認してください。",
        );
      }
      const completeness = getMonthlyEffortCompleteness(tx, input.month);
      if (completeness.blockers.length) {
        throw new Error(
          `未提出または配賦不一致が ${completeness.blockers.length} 件あります。工数の確認事項を解消してください。`,
        );
      }
      const occurredAt = input.occurredAt ?? new Date().toISOString();
      const updated = updateMonthlyCostClose(tx, close.id, {
        effortStatus: nextStatus,
        ...(nextStatus === "in_review"
          ? {
              effortReviewedByMemberId: input.actorMemberId,
              effortReviewedAt: occurredAt,
            }
          : {
              effortConfirmedByMemberId: input.actorMemberId,
              effortConfirmedAt: occurredAt,
            }),
        updatedAt: occurredAt,
      });
      appendMonthlyCostCloseEvent(tx, {
        closeId: close.id,
        eventType:
          nextStatus === "in_review" ? "effort_reviewed" : "effort_confirmed",
        actorMemberId: input.actorMemberId,
        previousStatus: close.status,
        nextStatus: close.status,
        previousEffortStatus: close.effortStatus,
        nextEffortStatus: nextStatus,
        occurredAt,
      });
      return updated;
    },
    { behavior: "immediate" },
  );
}

export function startMonthlyEffortReview(
  db: KosuDatabase,
  input: { month: string; actorMemberId: string; occurredAt?: string },
) {
  return transitionEffort(db, input, "in_review");
}

export function confirmMonthlyEffortClose(
  db: KosuDatabase,
  input: { month: string; actorMemberId: string; occurredAt?: string },
) {
  return transitionEffort(db, input, "confirmed");
}
