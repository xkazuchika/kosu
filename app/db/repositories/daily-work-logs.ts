import { and, asc, eq, isNull, like } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { dailyWorkLogs } from "../schema";

export type DailyWorkLogInsert = {
  memberId: string;
  workDate: string;
  totalWorkingHours: number;
};

export type DailyWorkLogUpdate = Partial<DailyWorkLogInsert>;

export function listDailyWorkLogsByMember(db: KosuDatabase, memberId: string) {
  return db
    .select()
    .from(dailyWorkLogs)
    .where(and(eq(dailyWorkLogs.memberId, memberId), isNull(dailyWorkLogs.deletedAt)))
    .orderBy(asc(dailyWorkLogs.workDate))
    .all();
}

export function listDailyWorkLogsByMemberAndMonth(db: KosuDatabase, memberId: string, month: string) {
  return db
    .select()
    .from(dailyWorkLogs)
    .where(
      and(
        eq(dailyWorkLogs.memberId, memberId),
        like(dailyWorkLogs.workDate, `${month}%`),
        isNull(dailyWorkLogs.deletedAt),
      ),
    )
    .orderBy(asc(dailyWorkLogs.workDate))
    .all();
}

export function listDailyWorkLogsByMonth(db: KosuDatabase, month: string) {
  return db
    .select()
    .from(dailyWorkLogs)
    .where(and(like(dailyWorkLogs.workDate, `${month}%`), isNull(dailyWorkLogs.deletedAt)))
    .orderBy(asc(dailyWorkLogs.workDate), asc(dailyWorkLogs.memberId))
    .all();
}

export function findDailyWorkLogById(db: KosuDatabase, id: string) {
  return db.select().from(dailyWorkLogs).where(eq(dailyWorkLogs.id, id)).get();
}

export function findDailyWorkLogByMemberAndDate(db: KosuDatabase, memberId: string, workDate: string) {
  return db
    .select()
    .from(dailyWorkLogs)
    .where(and(eq(dailyWorkLogs.memberId, memberId), eq(dailyWorkLogs.workDate, workDate), isNull(dailyWorkLogs.deletedAt)))
    .get();
}

export function createDailyWorkLog(db: KosuDatabase, input: DailyWorkLogInsert) {
  return db
    .insert(dailyWorkLogs)
    .values({
      id: createId(),
      memberId: input.memberId,
      workDate: input.workDate,
      totalWorkingHours: input.totalWorkingHours,
    })
    .returning()
    .get();
}

export function updateDailyWorkLog(db: KosuDatabase, id: string, input: DailyWorkLogUpdate) {
  return db
    .update(dailyWorkLogs)
    .set({
      workDate: input.workDate,
      totalWorkingHours: input.totalWorkingHours,
    })
    .where(eq(dailyWorkLogs.id, id))
    .returning()
    .get();
}

export function deleteDailyWorkLog(db: KosuDatabase, id: string, deletedAt: string) {
  return db.update(dailyWorkLogs).set({ deletedAt }).where(eq(dailyWorkLogs.id, id)).returning().get();
}
