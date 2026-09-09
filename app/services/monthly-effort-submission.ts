import type { KosuDatabase } from "~/db/client";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { listDailyWorkLogsByMemberAndMonth } from "~/db/repositories/daily-work-logs";
import { findMemberById, listMembers } from "~/db/repositories/members";
import {
  findMonthlyEffortSubmission,
  invalidateSubmittedMonthlyEffort,
  listMonthlyEffortSubmissionsByMonth,
  listRequiredMonthlyEffortMemberIds,
  submitMonthlyEffortSubmission,
} from "~/db/repositories/monthly-effort-submissions";
import { requireOpenMonth, validateMonth } from "~/services/monthly-cost-close";

const epsilon = 0.0001;

export class MonthlyEffortSubmissionError extends Error {
  readonly unbalancedDates: string[];

  constructor(message: string, unbalancedDates: string[] = []) {
    super(message);
    this.name = "MonthlyEffortSubmissionError";
    this.unbalancedDates = unbalancedDates;
  }
}

export function listRequiredMonthlyEffortMembers(
  db: KosuDatabase,
  month: string,
) {
  validateMonth(month);
  const requiredIds = new Set(listRequiredMonthlyEffortMemberIds(db, month));
  return listMembers(db).filter((member) => requiredIds.has(member.id));
}

export function getMonthlyEffortSubmissionState(
  db: KosuDatabase,
  memberId: string,
  month: string,
) {
  validateMonth(month);
  const submission = findMonthlyEffortSubmission(db, memberId, month);

  return {
    memberId,
    month,
    status: submission?.status ?? ("draft" as const),
    submittedByMemberId: submission?.submittedByMemberId ?? null,
    submittedAt: submission?.submittedAt ?? null,
    invalidatedByMemberId: submission?.invalidatedByMemberId ?? null,
    invalidatedAt: submission?.invalidatedAt ?? null,
    isLegacyMigration: submission?.isLegacyMigration ?? false,
  };
}

export function listUnbalancedMonthlyWorkDates(
  db: KosuDatabase,
  memberId: string,
  month: string,
) {
  validateMonth(month);
  return listDailyWorkLogsByMemberAndMonth(db, memberId, month)
    .filter((workLog) => {
      const allocatedHours = listAllocationsByWorkLog(db, workLog.id).reduce(
        (total, allocation) => total + allocation.allocatedHours,
        0,
      );
      return Math.abs(workLog.totalWorkingHours - allocatedHours) > epsilon;
    })
    .map((workLog) => workLog.workDate);
}

export function submitMonthlyEffort(
  db: KosuDatabase,
  input: {
    memberId: string;
    month: string;
    actorMemberId: string;
    occurredAt?: string;
  },
) {
  validateMonth(input.month);

  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    requireOpenMonth(tx, input.month);

    const actor = findMemberById(tx, input.actorMemberId);
    const target = findMemberById(tx, input.memberId);
    if (!actor || !target) {
      throw new MonthlyEffortSubmissionError(
        "提出対象のメンバーが見つかりません。",
      );
    }
    if (actor.id !== target.id && actor.role !== "admin") {
      throw new Response("Forbidden", { status: 403 });
    }

    const requiredIds = new Set(
      listRequiredMonthlyEffortMemberIds(tx, input.month),
    );
    if (!requiredIds.has(target.id)) {
      throw new MonthlyEffortSubmissionError(
        `${target.displayName} は ${input.month} の工数提出対象ではありません。`,
      );
    }

    const unbalancedDates = listUnbalancedMonthlyWorkDates(
      tx,
      target.id,
      input.month,
    );
    if (unbalancedDates.length > 0) {
      throw new MonthlyEffortSubmissionError(
        `勤務時間と配賦時間が一致しない日が ${unbalancedDates.length} 日あります。`,
        unbalancedDates,
      );
    }

    return submitMonthlyEffortSubmission(tx, {
      memberId: target.id,
      month: input.month,
      actorMemberId: actor.id,
      submittedAt: input.occurredAt ?? new Date().toISOString(),
    });
  });
}

export function invalidateMonthlyEffortSubmission(
  db: KosuDatabase,
  input: {
    memberId: string;
    month: string;
    actorMemberId: string;
    occurredAt?: string;
  },
) {
  validateMonth(input.month);
  return invalidateSubmittedMonthlyEffort(db, {
    memberId: input.memberId,
    month: input.month,
    actorMemberId: input.actorMemberId,
    invalidatedAt: input.occurredAt ?? new Date().toISOString(),
  });
}

export function getMonthlyEffortSubmissionSummary(
  db: KosuDatabase,
  month: string,
) {
  const requiredMembers = listRequiredMonthlyEffortMembers(db, month);
  const submissions = listMonthlyEffortSubmissionsByMonth(db, month);
  const submissionByMemberId = new Map(
    submissions.map((submission) => [submission.memberId, submission]),
  );

  const members = requiredMembers.map((member) => {
    const submission = submissionByMemberId.get(member.id);
    return {
      member,
      status: submission?.status ?? ("draft" as const),
      submittedByMemberId: submission?.submittedByMemberId ?? null,
      submittedAt: submission?.submittedAt ?? null,
      invalidatedByMemberId: submission?.invalidatedByMemberId ?? null,
      invalidatedAt: submission?.invalidatedAt ?? null,
      isLegacyMigration: submission?.isLegacyMigration ?? false,
    };
  });

  const submittedCount = members.filter(
    (entry) => entry.status === "submitted",
  ).length;

  return {
    month,
    members,
    requiredCount: members.length,
    submittedCount,
    draftCount: members.length - submittedCount,
    allSubmitted: submittedCount === members.length,
  };
}
