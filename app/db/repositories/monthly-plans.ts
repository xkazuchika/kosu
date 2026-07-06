import { and, asc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { monthlyPlans } from "../schema";

export type MonthlyPlanInsert = {
  memberId: string;
  projectId: string;
  month: string;
  assignmentRole?: string;
  plannedHours: number;
  hourlyCostRateSnapshot?: number | null;
};

export type MonthlyPlanUpdate = Partial<MonthlyPlanInsert>;

export function listMonthlyPlansByMember(db: KosuDatabase, memberId: string) {
  return db
    .select()
    .from(monthlyPlans)
    .where(eq(monthlyPlans.memberId, memberId))
    .orderBy(asc(monthlyPlans.month), asc(monthlyPlans.projectId))
    .all();
}

export function listMonthlyPlansByMemberAndMonth(db: KosuDatabase, memberId: string, month: string) {
  return db
    .select()
    .from(monthlyPlans)
    .where(and(eq(monthlyPlans.memberId, memberId), eq(monthlyPlans.month, month)))
    .orderBy(asc(monthlyPlans.projectId))
    .all();
}

export function listMonthlyPlansByProject(db: KosuDatabase, projectId: string) {
  return db
    .select()
    .from(monthlyPlans)
    .where(eq(monthlyPlans.projectId, projectId))
    .orderBy(asc(monthlyPlans.month), asc(monthlyPlans.memberId))
    .all();
}

export function findMonthlyPlan(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
  month: string,
  assignmentRole = "",
) {
  return db
    .select()
    .from(monthlyPlans)
    .where(
      and(
        eq(monthlyPlans.memberId, memberId),
        eq(monthlyPlans.projectId, projectId),
        eq(monthlyPlans.month, month),
        eq(monthlyPlans.assignmentRole, assignmentRole),
      ),
    )
    .get();
}

export function createMonthlyPlan(db: KosuDatabase, input: MonthlyPlanInsert) {
  return db
    .insert(monthlyPlans)
    .values({
      id: createId(),
      memberId: input.memberId,
      projectId: input.projectId,
      month: input.month,
      assignmentRole: input.assignmentRole ?? "",
      plannedHours: input.plannedHours,
      hourlyCostRateSnapshot: input.hourlyCostRateSnapshot ?? null,
    })
    .returning()
    .get();
}

export function updateMonthlyPlan(db: KosuDatabase, id: string, input: MonthlyPlanUpdate) {
  return db
    .update(monthlyPlans)
    .set({
      plannedHours: input.plannedHours,
      hourlyCostRateSnapshot: input.hourlyCostRateSnapshot,
      assignmentRole: input.assignmentRole,
    })
    .where(eq(monthlyPlans.id, id))
    .returning()
    .get();
}

export function deleteMonthlyPlan(db: KosuDatabase, id: string) {
  return db.delete(monthlyPlans).where(eq(monthlyPlans.id, id)).returning().get();
}
