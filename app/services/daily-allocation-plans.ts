import type { KosuDatabase } from "~/db/client";
import {
  deleteDailyAllocationPlanByMemberDateProject,
  listDailyAllocationPlansByMemberAndDate,
  listDailyAllocationPlansByMemberAndMonth,
  upsertDailyAllocationPlan,
} from "~/db/repositories/daily-allocation-plans";
import {
  createDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
  updateDailyWorkLog,
} from "~/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  listAllocationsByWorkLog,
} from "~/db/repositories/effort-allocations";
import { findMemberById } from "~/db/repositories/members";
import { findActiveAssignment } from "~/db/repositories/project-assignments";
import { findProjectById } from "~/db/repositories/projects";
import {
  isValidCalendarDate,
  isValidDailyHours,
  isValidMonth,
  listMonthDates,
} from "~/lib/time";
import { requireUnlockedMonth } from "~/services/period-lock";

export class DailyAllocationPlanError extends Error {}

export type DailyAllocationPlanCellInput = {
  planDate: string;
  projectId: string;
  plannedHours: string;
};

export type SaveDailyAllocationPlansInput = {
  cells: DailyAllocationPlanCellInput[];
  memberId: string;
  month: string;
};

export type CopyDailyAllocationPlansInput = {
  memberId: string;
  month: string;
};

export function saveDailyAllocationPlans(
  db: KosuDatabase,
  input: SaveDailyAllocationPlansInput,
) {
  validateMonth(input.month);
  requireUnlockedMonth(db, input.month);

  const parsedCells = input.cells.map((cell) =>
    parseDailyPlanCell(input.month, cell),
  );
  const seenKeys = new Set<string>();
  const finalPlansByDate = new Map<string, Map<string, number>>();

  for (const cell of parsedCells) {
    const key = `${cell.planDate}|${cell.projectId}`;

    if (seenKeys.has(key)) {
      throw new DailyAllocationPlanError(
        "同じ日付と案件の予定が重複しています。",
      );
    }
    seenKeys.add(key);

    if (!finalPlansByDate.has(cell.planDate)) {
      finalPlansByDate.set(
        cell.planDate,
        new Map(
          listDailyAllocationPlansByMemberAndDate(
            db,
            input.memberId,
            cell.planDate,
          ).map((plan) => [plan.projectId, plan.plannedHours]),
        ),
      );
    }

    const finalDatePlans = finalPlansByDate.get(cell.planDate)!;

    if (cell.plannedHours === null) {
      finalDatePlans.delete(cell.projectId);
    } else {
      validateAssignedActiveProject(db, input.memberId, cell.projectId);
      finalDatePlans.set(cell.projectId, cell.plannedHours);
    }
  }

  for (const [planDate, projectPlans] of finalPlansByDate.entries()) {
    const total = [...projectPlans.values()].reduce(
      (sum, plannedHours) => sum + plannedHours,
      0,
    );

    if (total > 24) {
      throw new DailyAllocationPlanError(
        `${planDate} の予定合計は24h以下にしてください。`,
      );
    }
  }

  let upserted = 0;
  let deleted = 0;

  for (const cell of parsedCells) {
    if (cell.plannedHours === null) {
      const removed = deleteDailyAllocationPlanByMemberDateProject(
        db,
        input.memberId,
        cell.planDate,
        cell.projectId,
      );
      if (removed) deleted += 1;
      continue;
    }

    upsertDailyAllocationPlan(db, {
      memberId: input.memberId,
      projectId: cell.projectId,
      planDate: cell.planDate,
      plannedHours: cell.plannedHours,
    });
    upserted += 1;
  }

  return { deleted, upserted };
}

export function copyDailyAllocationPlansToActuals(
  db: KosuDatabase,
  input: CopyDailyAllocationPlansInput,
) {
  validateMonth(input.month);
  requireUnlockedMonth(db, input.month);

  const targetMember = findMemberById(db, input.memberId);

  if (!targetMember) {
    throw new DailyAllocationPlanError("対象メンバーが見つかりません。");
  }

  const plans = listDailyAllocationPlansByMemberAndMonth(
    db,
    input.memberId,
    input.month,
  );
  const plansByDate = new Map<string, typeof plans>();

  for (const plan of plans) {
    const datePlans = plansByDate.get(plan.planDate) ?? [];
    datePlans.push(plan);
    plansByDate.set(plan.planDate, datePlans);
  }

  const summary = {
    copiedDates: 0,
    createdAllocations: 0,
    skippedExistingActualDates: 0,
    skippedNoPlanDates: 0,
  };

  db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;

    for (const planDate of listMonthDates(input.month)) {
      const datePlans = plansByDate.get(planDate) ?? [];

      if (datePlans.length === 0) {
        summary.skippedNoPlanDates += 1;
        continue;
      }

      const workLog = findDailyWorkLogByMemberAndDate(
        tx,
        input.memberId,
        planDate,
      );
      const existingAllocations = workLog
        ? listAllocationsByWorkLog(tx, workLog.id)
        : [];

      if (existingAllocations.length > 0) {
        summary.skippedExistingActualDates += 1;
        continue;
      }

      const totalWorkingHours = datePlans.reduce(
        (sum, plan) => sum + plan.plannedHours,
        0,
      );
      if (
        datePlans.some((plan) => !isValidDailyHours(plan.plannedHours)) ||
        totalWorkingHours > 24
      ) {
        throw new DailyAllocationPlanError(
          `${planDate} の予定は各値と合計を24h以下にしてください。`,
        );
      }
      const targetWorkLog = workLog
        ? updateDailyWorkLog(tx, workLog.id, { totalWorkingHours })
        : createDailyWorkLog(tx, {
            memberId: input.memberId,
            workDate: planDate,
            totalWorkingHours,
          });

      for (const plan of datePlans) {
        validateAssignedActiveProject(tx, input.memberId, plan.projectId);
        createEffortAllocation(tx, {
          dailyWorkLogId: targetWorkLog.id,
          memberId: input.memberId,
          projectId: plan.projectId,
          taskId: null,
          allocatedHours: plan.plannedHours,
          note: null,
          hourlyCostRateSnapshot: targetMember.hourlyCostRate ?? null,
        });
        summary.createdAllocations += 1;
      }

      summary.copiedDates += 1;
    }
  });

  return summary;
}

export function getDailyPlanTotalsByDate(
  db: KosuDatabase,
  memberId: string,
  month: string,
) {
  return new Map(
    listMonthDates(month).map((planDate) => [
      planDate,
      listDailyAllocationPlansByMemberAndDate(db, memberId, planDate).reduce(
        (sum, plan) => sum + plan.plannedHours,
        0,
      ),
    ]),
  );
}

function validateMonth(month: string) {
  if (!isValidMonth(month)) {
    throw new DailyAllocationPlanError("対象月が不正です。");
  }
}

function parseDailyPlanCell(month: string, cell: DailyAllocationPlanCellInput) {
  if (
    !isValidCalendarDate(cell.planDate) ||
    !cell.planDate.startsWith(`${month}-`)
  ) {
    throw new DailyAllocationPlanError("対象月の日付だけ入力できます。");
  }

  if (!cell.projectId) {
    throw new DailyAllocationPlanError("案件を選択してください。");
  }

  const raw = cell.plannedHours.trim();

  if (raw === "") {
    return {
      planDate: cell.planDate,
      projectId: cell.projectId,
      plannedHours: null as number | null,
    };
  }

  const plannedHours = Number(raw);

  if (plannedHours === 0) {
    return {
      planDate: cell.planDate,
      projectId: cell.projectId,
      plannedHours: null as number | null,
    };
  }

  if (!isValidDailyHours(plannedHours)) {
    throw new DailyAllocationPlanError(
      "予定工数は 0.25h 単位の正の値で、24h 以下にしてください。",
    );
  }

  return { planDate: cell.planDate, projectId: cell.projectId, plannedHours };
}

function validateAssignedActiveProject(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
) {
  const project = findProjectById(db, projectId);

  if (!project || project.isArchived) {
    throw new DailyAllocationPlanError("有効な案件を選択してください。");
  }

  if (!findActiveAssignment(db, memberId, projectId)) {
    throw new DailyAllocationPlanError(
      "アサインされていない案件は日別予定工数に登録できません。",
    );
  }
}
