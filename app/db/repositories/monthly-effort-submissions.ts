import { and, asc, eq, sql } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { monthlyEffortSubmissions } from "../schema";

export type MonthlyEffortSubmissionStatus = "draft" | "submitted";

export function listRequiredMonthlyEffortMemberIds(
  db: KosuDatabase,
  month: string,
) {
  return db
    .all<{ id: string }>(
      sql`
      SELECT DISTINCT member.id
      FROM members AS member
      WHERE (
        member.is_active = 1
        AND substr(member.created_at, 1, 7) <= ${month}
      )
      OR EXISTS (
        SELECT 1 FROM member_monthly_capacities AS capacity
        WHERE capacity.member_id = member.id AND capacity.month = ${month}
      )
      OR EXISTS (
        SELECT 1 FROM monthly_plans AS monthly_plan
        WHERE monthly_plan.member_id = member.id AND monthly_plan.month = ${month}
      )
      OR EXISTS (
        SELECT 1 FROM daily_allocation_plans AS daily_plan
        WHERE daily_plan.member_id = member.id
          AND substr(daily_plan.plan_date, 1, 7) = ${month}
      )
      OR EXISTS (
        SELECT 1 FROM daily_work_logs AS work_log
        WHERE work_log.member_id = member.id
          AND substr(work_log.work_date, 1, 7) = ${month}
      )
      OR EXISTS (
        SELECT 1
        FROM effort_allocations AS allocation
        INNER JOIN daily_work_logs AS allocation_work_log
          ON allocation_work_log.id = allocation.daily_work_log_id
        WHERE allocation.member_id = member.id
          AND substr(allocation_work_log.work_date, 1, 7) = ${month}
      )
      OR EXISTS (
        SELECT 1 FROM monthly_effort_submissions AS submission
        WHERE submission.member_id = member.id AND submission.month = ${month}
      )
      ORDER BY member.id
    `,
    )
    .map((row) => row.id);
}

export function findMonthlyEffortSubmission(
  db: KosuDatabase,
  memberId: string,
  month: string,
) {
  return db
    .select()
    .from(monthlyEffortSubmissions)
    .where(
      and(
        eq(monthlyEffortSubmissions.memberId, memberId),
        eq(monthlyEffortSubmissions.month, month),
      ),
    )
    .get();
}

export function listMonthlyEffortSubmissionsByMonth(
  db: KosuDatabase,
  month: string,
) {
  return db
    .select()
    .from(monthlyEffortSubmissions)
    .where(eq(monthlyEffortSubmissions.month, month))
    .orderBy(asc(monthlyEffortSubmissions.memberId))
    .all();
}

export function listMissingMonthlyEffortMemberIds(
  db: KosuDatabase,
  month: string,
) {
  const submittedIds = new Set(
    listMonthlyEffortSubmissionsByMonth(db, month)
      .filter((submission) => submission.status === "submitted")
      .map((submission) => submission.memberId),
  );
  return listRequiredMonthlyEffortMemberIds(db, month).filter(
    (memberId) => !submittedIds.has(memberId),
  );
}

export function submitMonthlyEffortSubmission(
  db: KosuDatabase,
  input: {
    memberId: string;
    month: string;
    actorMemberId: string;
    submittedAt: string;
    isLegacyMigration?: boolean;
  },
) {
  return db
    .insert(monthlyEffortSubmissions)
    .values({
      id: createId(),
      memberId: input.memberId,
      month: input.month,
      status: "submitted",
      submittedByMemberId: input.actorMemberId,
      submittedAt: input.submittedAt,
      isLegacyMigration: input.isLegacyMigration ?? false,
      updatedAt: input.submittedAt,
    })
    .onConflictDoUpdate({
      target: [
        monthlyEffortSubmissions.memberId,
        monthlyEffortSubmissions.month,
      ],
      set: {
        status: "submitted",
        submittedByMemberId: input.actorMemberId,
        submittedAt: input.submittedAt,
        isLegacyMigration: input.isLegacyMigration ?? false,
        updatedAt: input.submittedAt,
      },
    })
    .returning()
    .get();
}

export function invalidateSubmittedMonthlyEffort(
  db: KosuDatabase,
  input: {
    memberId: string;
    month: string;
    actorMemberId: string;
    invalidatedAt: string;
  },
) {
  return db
    .update(monthlyEffortSubmissions)
    .set({
      status: "draft",
      submittedByMemberId: null,
      submittedAt: null,
      invalidatedByMemberId: input.actorMemberId,
      invalidatedAt: input.invalidatedAt,
      updatedAt: input.invalidatedAt,
    })
    .where(
      and(
        eq(monthlyEffortSubmissions.memberId, input.memberId),
        eq(monthlyEffortSubmissions.month, input.month),
        eq(monthlyEffortSubmissions.status, "submitted"),
      ),
    )
    .returning()
    .get();
}
