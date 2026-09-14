import { and, eq } from "drizzle-orm";
import type { KosuDatabase } from "../client";
import { memberMonthlyPlanReviews } from "../schema";

export function findMonthlyPlanReview(
  db: KosuDatabase,
  memberId: string,
  month: string,
) {
  return db
    .select()
    .from(memberMonthlyPlanReviews)
    .where(
      and(
        eq(memberMonthlyPlanReviews.memberId, memberId),
        eq(memberMonthlyPlanReviews.month, month),
      ),
    )
    .get();
}

export function saveMonthlyPlanConfirmation(
  db: KosuDatabase,
  input: {
    memberId: string;
    month: string;
    revision: number;
    confirmedByMemberId: string;
  },
) {
  const values = { ...input, confirmedAt: new Date().toISOString() };
  return db
    .insert(memberMonthlyPlanReviews)
    .values(values)
    .onConflictDoUpdate({
      target: [
        memberMonthlyPlanReviews.memberId,
        memberMonthlyPlanReviews.month,
      ],
      set: {
        confirmedAt: values.confirmedAt,
        confirmedByMemberId: input.confirmedByMemberId,
      },
    })
    .returning()
    .get();
}
