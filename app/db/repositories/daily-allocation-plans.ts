import { and, asc, eq, like, sql } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { dailyAllocationPlans } from "../schema";

export type DailyAllocationPlanInsert = {
  memberId: string;
  projectId: string;
  planDate: string;
  plannedHours: number;
};

export type DailyAllocationPlanUpdate = Partial<Pick<DailyAllocationPlanInsert, "plannedHours">>;

export function listDailyAllocationPlansByMemberAndMonth(db: KosuDatabase, memberId: string, month: string) {
  return db
    .select()
    .from(dailyAllocationPlans)
    .where(and(eq(dailyAllocationPlans.memberId, memberId), like(dailyAllocationPlans.planDate, `${month}%`)))
    .orderBy(asc(dailyAllocationPlans.planDate), asc(dailyAllocationPlans.projectId))
    .all();
}

export function listDailyAllocationPlansByMemberAndDate(db: KosuDatabase, memberId: string, planDate: string) {
  return db
    .select()
    .from(dailyAllocationPlans)
    .where(and(eq(dailyAllocationPlans.memberId, memberId), eq(dailyAllocationPlans.planDate, planDate)))
    .orderBy(asc(dailyAllocationPlans.projectId))
    .all();
}

export function findDailyAllocationPlan(
  db: KosuDatabase,
  memberId: string,
  planDate: string,
  projectId: string,
) {
  return db
    .select()
    .from(dailyAllocationPlans)
    .where(
      and(
        eq(dailyAllocationPlans.memberId, memberId),
        eq(dailyAllocationPlans.planDate, planDate),
        eq(dailyAllocationPlans.projectId, projectId),
      ),
    )
    .get();
}

export function upsertDailyAllocationPlan(db: KosuDatabase, input: DailyAllocationPlanInsert) {
  const existing = findDailyAllocationPlan(db, input.memberId, input.planDate, input.projectId);

  if (existing) {
    return db
      .update(dailyAllocationPlans)
      .set({ plannedHours: input.plannedHours })
      .where(eq(dailyAllocationPlans.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(dailyAllocationPlans)
    .values({
      id: createId(),
      memberId: input.memberId,
      projectId: input.projectId,
      planDate: input.planDate,
      plannedHours: input.plannedHours,
    })
    .returning()
    .get();
}

export function deleteDailyAllocationPlan(db: KosuDatabase, id: string) {
  return db.delete(dailyAllocationPlans).where(eq(dailyAllocationPlans.id, id)).returning().get();
}

export function deleteDailyAllocationPlanByMemberDateProject(
  db: KosuDatabase,
  memberId: string,
  planDate: string,
  projectId: string,
) {
  return db
    .delete(dailyAllocationPlans)
    .where(
      and(
        eq(dailyAllocationPlans.memberId, memberId),
        eq(dailyAllocationPlans.planDate, planDate),
        eq(dailyAllocationPlans.projectId, projectId),
      ),
    )
    .returning()
    .get();
}

export function aggregateDailyAllocationPlanTotalsByDate(db: KosuDatabase, memberId: string, month: string) {
  return db
    .select({
      planDate: dailyAllocationPlans.planDate,
      totalPlannedHours: sql<number>`sum(${dailyAllocationPlans.plannedHours})`,
    })
    .from(dailyAllocationPlans)
    .where(and(eq(dailyAllocationPlans.memberId, memberId), like(dailyAllocationPlans.planDate, `${month}%`)))
    .groupBy(dailyAllocationPlans.planDate)
    .orderBy(asc(dailyAllocationPlans.planDate))
    .all();
}

export function aggregateDailyAllocationPlanTotalsByProject(db: KosuDatabase, memberId: string, month: string) {
  return db
    .select({
      projectId: dailyAllocationPlans.projectId,
      totalPlannedHours: sql<number>`sum(${dailyAllocationPlans.plannedHours})`,
    })
    .from(dailyAllocationPlans)
    .where(and(eq(dailyAllocationPlans.memberId, memberId), like(dailyAllocationPlans.planDate, `${month}%`)))
    .groupBy(dailyAllocationPlans.projectId)
    .orderBy(asc(dailyAllocationPlans.projectId))
    .all();
}
