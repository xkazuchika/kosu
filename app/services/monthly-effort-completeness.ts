import type { KosuDatabase } from "~/db/client";
import { listDailyWorkLogsByMonth } from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { listMembers } from "~/db/repositories/members";
import { validateMonth } from "./monthly-cost-close";
import { getMonthlyEffortSubmissionSummary } from "./monthly-effort-submission";
import type { MonthlyCostIssue } from "./monthly-cost-completeness";

export function getMonthlyEffortCompleteness(db: KosuDatabase, month: string) {
  validateMonth(month);
  const blockers: MonthlyCostIssue[] = [];
  const memberById = new Map(
    listMembers(db).map((member) => [member.id, member]),
  );
  const workLogs = listDailyWorkLogsByMonth(db, month);
  const epsilon = 0.0001;
  for (const entry of getMonthlyEffortSubmissionSummary(db, month).members) {
    if (entry.status === "submitted") continue;

    blockers.push({
      code: "MISSING_EFFORT_SUBMISSION",
      severity: "blocking",
      key: `MISSING_EFFORT_SUBMISSION:${entry.member.id}:${month}`,
      title: "月次工数が未提出です",
      detail: `${entry.member.displayName} / ${month}`,
      href: `/work-logs/month?month=${month}&memberId=${entry.member.id}`,
      memberId: entry.member.id,
    });
  }

  for (const workLog of workLogs) {
    const allocatedHours = listAllocationsByWorkLog(db, workLog.id).reduce(
      (total, allocation) => total + allocation.allocatedHours,
      0,
    );

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

  return { blockers };
}
