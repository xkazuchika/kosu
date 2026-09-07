import type { KosuDatabase } from "~/db/client";
import { findDailyWorkLogByMemberAndDate } from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { addCalendarDays, listWeekDates } from "~/lib/time";
import {
  DailyEffortEntryError,
  applyValidatedDailyEffortEntry,
  validateDailyEffortEntry,
} from "~/services/daily-effort-entry";
import { requireUnlockedMonth } from "~/services/period-lock";

export type WeeklyEffortDraftRow = {
  key: string;
  projectId: string;
  taskId: string;
  note: string;
  allocationIds: Record<string, string>;
  hours: Record<string, string>;
};

export type WeeklyEffortDraft = {
  weekDate: string;
  dates: string[];
  totalWorkingHours: Record<string, string>;
  rows: WeeklyEffortDraftRow[];
};

export function getWeeklyEffortDraft(
  db: KosuDatabase,
  memberId: string,
  selectedDate: string,
): WeeklyEffortDraft {
  const dates = listWeekDates(selectedDate);
  if (dates.length !== 7)
    throw new DailyEffortEntryError("週の基準日が不正です。");

  const totalWorkingHours: Record<string, string> = {};
  const rowsBySignature = new Map<string, WeeklyEffortDraftRow[]>();

  for (const date of dates) {
    const log = findDailyWorkLogByMemberAndDate(db, memberId, date);
    totalWorkingHours[date] = log ? String(log.totalWorkingHours) : "";
    if (!log) continue;

    const occurrence = new Map<string, number>();
    for (const allocation of listAllocationsByWorkLog(db, log.id)) {
      const signature = JSON.stringify([
        allocation.projectId,
        allocation.taskId ?? "",
        allocation.note ?? "",
      ]);
      const index = occurrence.get(signature) ?? 0;
      occurrence.set(signature, index + 1);
      const signatureRows = rowsBySignature.get(signature) ?? [];
      let row = signatureRows[index];
      if (!row) {
        row = {
          key: `${signature}-${index}`,
          projectId: allocation.projectId,
          taskId: allocation.taskId ?? "",
          note: allocation.note ?? "",
          allocationIds: {},
          hours: {},
        };
        signatureRows[index] = row;
        rowsBySignature.set(signature, signatureRows);
      }
      row.allocationIds[date] = allocation.id;
      row.hours[date] = String(allocation.allocatedHours);
    }
  }

  return {
    weekDate: dates[0],
    dates,
    totalWorkingHours,
    rows: [...rowsBySignature.values()].flat(),
  };
}

export function saveWeeklyEffortDraft(
  db: KosuDatabase,
  memberId: string,
  draft: WeeklyEffortDraft,
) {
  const expectedDates = listWeekDates(draft.weekDate);
  if (
    expectedDates.length !== 7 ||
    expectedDates.some((date, index) => draft.dates[index] !== date)
  ) {
    throw new DailyEffortEntryError("週の対象日が不正です。");
  }

  const entries: ReturnType<typeof validateDailyEffortEntry>[] = [];
  for (const date of expectedDates) {
    const totalRaw = draft.totalWorkingHours[date]?.trim() ?? "";
    const rows = draft.rows
      .filter((row) => (row.hours[date]?.trim() ?? "") !== "")
      .map((row) => ({
        allocationId: row.allocationIds[date] || undefined,
        projectId: row.projectId,
        taskId: row.taskId || undefined,
        allocatedHours: Number(row.hours[date]),
        note: row.note || undefined,
      }));
    if (!totalRaw && rows.length === 0) continue;
    if (!totalRaw)
      throw new DailyEffortEntryError(
        `${date}: 総稼働時間を入力してください。`,
      );

    try {
      requireUnlockedMonth(db, date.slice(0, 7));
      entries.push(
        validateDailyEffortEntry(db, {
          memberId,
          workDate: date,
          totalWorkingHours: Number(totalRaw),
          rows,
        }),
      );
    } catch (error) {
      if (error instanceof DailyEffortEntryError)
        throw new DailyEffortEntryError(`${date}: ${error.message}`);
      throw error;
    }
  }

  const occurredAt = new Date().toISOString();
  db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    for (const entry of entries)
      applyValidatedDailyEffortEntry(tx, entry, occurredAt);
  });
  return {
    changedDates: entries.length,
    nextWeekDate: addCalendarDays(expectedDates[0], 7),
  };
}
