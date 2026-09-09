import type { KosuDatabase } from "~/db/client";
import { listDailyAllocationPlansByMemberAndDate } from "~/db/repositories/daily-allocation-plans";
import {
  createDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
  listDailyWorkLogsByMember,
  updateDailyWorkLog,
} from "~/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  deleteEffortAllocation,
  findAllocationById,
  listAllocationsByWorkLog,
  updateEffortAllocation,
} from "~/db/repositories/effort-allocations";
import { findMemberById } from "~/db/repositories/members";
import { findActiveAssignment } from "~/db/repositories/project-assignments";
import { findProjectById } from "~/db/repositories/projects";
import { findTaskById } from "~/db/repositories/tasks";
import { isValidCalendarDate, isValidDailyHours } from "~/lib/time";
import { requireUnlockedMonth } from "~/services/period-lock";

export type DailyEffortDraftRow = {
  allocationId?: string;
  projectId: string;
  taskId?: string;
  allocatedHours: number;
  note?: string;
};

export type DailyEffortEntryInput = {
  memberId: string;
  workDate: string;
  totalWorkingHours: number;
  rows: DailyEffortDraftRow[];
};

export type DailyEffortStartingPoint = {
  source: "daily-plan" | "recent-workday";
  sourceDate: string;
  totalWorkingHours: number;
  rows: DailyEffortDraftRow[];
};

export class DailyEffortEntryError extends Error {}

type Allocation = NonNullable<ReturnType<typeof findAllocationById>>;

export function validateDailyEffortEntry(
  db: KosuDatabase,
  input: DailyEffortEntryInput,
) {
  if (!isValidCalendarDate(input.workDate)) {
    throw new DailyEffortEntryError("日付が不正です。");
  }
  if (!isValidDailyHours(input.totalWorkingHours)) {
    throw new DailyEffortEntryError(
      "総稼働時間は 0.25h 単位の正の値で、24h 以下にしてください。",
    );
  }

  const workLog = findDailyWorkLogByMemberAndDate(
    db,
    input.memberId,
    input.workDate,
  );
  const currentAllocations = workLog
    ? listAllocationsByWorkLog(db, workLog.id)
    : [];
  const currentById = new Map(
    currentAllocations.map((allocation) => [allocation.id, allocation]),
  );
  const submittedIds = new Set<string>();
  const rows = input.rows.map((row) => {
    if (!row.projectId)
      throw new DailyEffortEntryError("案件を選択してください。");
    if (!isValidDailyHours(row.allocatedHours)) {
      throw new DailyEffortEntryError(
        "実績工数は 0.25h 単位の正の値で、24h 以下にしてください。",
      );
    }

    let existing: Allocation | undefined;
    if (row.allocationId) {
      if (submittedIds.has(row.allocationId)) {
        throw new DailyEffortEntryError(
          "同じ実績工数が重複して送信されました。",
        );
      }
      submittedIds.add(row.allocationId);
      existing = currentById.get(row.allocationId);
      if (!existing)
        throw new DailyEffortEntryError("対象の実績工数が見つかりません。");
    }

    const taskId = row.taskId || existing?.taskId || undefined;
    const error = validateAllocationTarget(
      db,
      input.memberId,
      row.projectId,
      taskId,
      existing,
    );
    if (error) throw new DailyEffortEntryError(error);

    return {
      allocationId: row.allocationId,
      projectId: row.projectId,
      taskId,
      allocatedHours: row.allocatedHours,
      note: row.note?.trim() || undefined,
    };
  });

  if (rows.reduce((sum, row) => sum + row.allocatedHours, 0) > 24) {
    throw new DailyEffortEntryError(
      "1日の実績工数の合計は 24h 以下にしてください。",
    );
  }

  return {
    ...input,
    workLog,
    rows,
    removedAllocationIds: currentAllocations
      .filter((allocation) => !submittedIds.has(allocation.id))
      .map((allocation) => allocation.id),
  };
}

export function applyValidatedDailyEffortEntry(
  db: KosuDatabase,
  entry: ReturnType<typeof validateDailyEffortEntry>,
  occurredAt = new Date().toISOString(),
) {
  const targetMember = findMemberById(db, entry.memberId);
  if (!targetMember)
    throw new DailyEffortEntryError("対象メンバーが見つかりません。");

  const workLog = entry.workLog
    ? updateDailyWorkLog(db, entry.workLog.id, {
        totalWorkingHours: entry.totalWorkingHours,
      })
    : createDailyWorkLog(db, {
        memberId: entry.memberId,
        workDate: entry.workDate,
        totalWorkingHours: entry.totalWorkingHours,
      });

  for (const allocationId of entry.removedAllocationIds) {
    deleteEffortAllocation(db, allocationId, occurredAt);
  }

  for (const row of entry.rows) {
    if (row.allocationId) {
      updateEffortAllocation(db, row.allocationId, {
        projectId: row.projectId,
        taskId: row.taskId ?? null,
        allocatedHours: row.allocatedHours,
        note: row.note ?? null,
      });
    } else {
      createEffortAllocation(db, {
        dailyWorkLogId: workLog.id,
        memberId: entry.memberId,
        projectId: row.projectId,
        taskId: row.taskId ?? null,
        allocatedHours: row.allocatedHours,
        note: row.note,
        hourlyCostRateSnapshot: targetMember.hourlyCostRate ?? null,
      });
    }
  }

  return {
    allocationCount: entry.rows.length,
    removedCount: entry.removedAllocationIds.length,
  };
}

export function saveDailyEffortEntry(
  db: KosuDatabase,
  input: DailyEffortEntryInput,
) {
  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    requireUnlockedMonth(tx, input.workDate.slice(0, 7));
    const validated = validateDailyEffortEntry(tx, input);
    return applyValidatedDailyEffortEntry(tx, validated);
  });
}

export function getDailyEffortStartingPoint(
  db: KosuDatabase,
  input: {
    memberId: string;
    workDate: string;
    source: "daily-plan" | "recent-workday";
  },
): DailyEffortStartingPoint {
  const currentLog = findDailyWorkLogByMemberAndDate(
    db,
    input.memberId,
    input.workDate,
  );
  if (currentLog && listAllocationsByWorkLog(db, currentLog.id).length > 0) {
    throw new DailyEffortEntryError(
      "既に実績工数があるため下書きで上書きできません。",
    );
  }

  if (input.source === "daily-plan") {
    const rows = listDailyAllocationPlansByMemberAndDate(
      db,
      input.memberId,
      input.workDate,
    )
      .filter(
        (plan) => !validateAllocationTarget(db, input.memberId, plan.projectId),
      )
      .map((plan) => ({
        projectId: plan.projectId,
        allocatedHours: plan.plannedHours,
      }));
    if (rows.length === 0)
      throw new DailyEffortEntryError(
        "この日に利用できる予定工数がありません。",
      );
    return {
      source: "daily-plan",
      sourceDate: input.workDate,
      totalWorkingHours: rows.reduce((sum, row) => sum + row.allocatedHours, 0),
      rows,
    };
  }

  const earlierLogs = listDailyWorkLogsByMember(db, input.memberId)
    .filter((log) => log.workDate < input.workDate)
    .sort((a, b) => b.workDate.localeCompare(a.workDate));
  for (const log of earlierLogs) {
    const rows = listAllocationsByWorkLog(db, log.id)
      .filter(
        (allocation) =>
          !validateAllocationTarget(
            db,
            input.memberId,
            allocation.projectId,
            allocation.taskId ?? undefined,
          ),
      )
      .map((allocation) => ({
        projectId: allocation.projectId,
        taskId: allocation.taskId ?? undefined,
        allocatedHours: allocation.allocatedHours,
        note: allocation.note ?? undefined,
      }));
    if (rows.length > 0) {
      return {
        source: "recent-workday",
        sourceDate: log.workDate,
        totalWorkingHours: log.totalWorkingHours,
        rows,
      };
    }
  }
  throw new DailyEffortEntryError(
    "以前の勤務日に複製できる実績工数がありません。",
  );
}

function validateAllocationTarget(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
  taskId?: string,
  existing?: Allocation,
) {
  const project = findProjectById(db, projectId);
  if (!project) return "有効な案件を選択してください。";

  const keepsExistingProject = existing?.projectId === projectId;
  if (
    !keepsExistingProject &&
    (project.isArchived || !findActiveAssignment(db, memberId, projectId))
  ) {
    return project.isArchived
      ? "有効な案件を選択してください。"
      : "アサインされていない案件には実績工数を登録できません。";
  }

  if (!taskId) return undefined;
  const task = findTaskById(db, taskId);
  if (!task || task.projectId !== projectId)
    return "選択した案件の有効なタスクを選択してください。";
  if (existing?.taskId !== taskId && task.isArchived)
    return "有効なタスクを選択してください。";
  return undefined;
}
