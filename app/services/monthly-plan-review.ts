import type { KosuDatabase } from "~/db/client";
import { findMemberById } from "~/db/repositories/members";
import {
  findMonthlyPlanReview,
  saveMonthlyPlanConfirmation,
} from "~/db/repositories/member-monthly-plan-reviews";
import { isValidMonth } from "~/lib/time";
import { requireUnlockedMonth } from "~/services/period-lock";

export class MonthlyPlanReviewError extends Error {}

export function confirmMonthlyPlan(
  db: KosuDatabase,
  input: {
    actorMemberId: string;
    memberId: string;
    month: string;
    revision: number;
  },
) {
  return db.transaction(
    (transaction) => {
      const tx = transaction as unknown as KosuDatabase;
      const actor = findMemberById(tx, input.actorMemberId);
      if (!actor?.isActive || actor.role !== "admin")
        throw new Response("Forbidden", { status: 403 });
      if (
        !isValidMonth(input.month) ||
        input.month.startsWith("0000-") ||
        !Number.isSafeInteger(input.revision) ||
        input.revision < 0
      ) {
        throw new MonthlyPlanReviewError(
          "対象月または確認情報が不正です。画面を再表示してください。",
        );
      }
      const member = findMemberById(tx, input.memberId);
      if (!member?.isActive)
        throw new MonthlyPlanReviewError("有効なメンバーを指定してください。");
      requireUnlockedMonth(tx, input.month);
      const review = findMonthlyPlanReview(tx, input.memberId, input.month);
      if ((review?.revision ?? 0) !== input.revision) {
        throw new MonthlyPlanReviewError(
          "予定または稼働可能時間が変更されています。最新の内容を確認してください。",
        );
      }
      return saveMonthlyPlanConfirmation(tx, {
        memberId: input.memberId,
        month: input.month,
        revision: input.revision,
        confirmedByMemberId: actor.id,
      });
    },
    { behavior: "immediate" },
  );
}
