import { and, asc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { memberMonthlyCapacities } from "../schema";

export type MemberMonthlyCapacityInsert = {
  memberId: string;
  month: string;
  capacityHours: number;
};

export type MemberMonthlyCapacityUpdate = Partial<MemberMonthlyCapacityInsert>;

export function listCapacitiesByMember(db: KosuDatabase, memberId: string) {
  return db
    .select()
    .from(memberMonthlyCapacities)
    .where(eq(memberMonthlyCapacities.memberId, memberId))
    .orderBy(asc(memberMonthlyCapacities.month))
    .all();
}

export function findCapacityByMemberAndMonth(db: KosuDatabase, memberId: string, month: string) {
  return db
    .select()
    .from(memberMonthlyCapacities)
    .where(and(eq(memberMonthlyCapacities.memberId, memberId), eq(memberMonthlyCapacities.month, month)))
    .get();
}

export function findMemberMonthlyCapacityById(db: KosuDatabase, id: string) {
  return db.select().from(memberMonthlyCapacities).where(eq(memberMonthlyCapacities.id, id)).get();
}

export function createMemberMonthlyCapacity(db: KosuDatabase, input: MemberMonthlyCapacityInsert) {
  return db
    .insert(memberMonthlyCapacities)
    .values({ id: createId(), memberId: input.memberId, month: input.month, capacityHours: input.capacityHours })
    .returning()
    .get();
}

export function updateMemberMonthlyCapacity(db: KosuDatabase, id: string, input: MemberMonthlyCapacityUpdate) {
  return db
    .update(memberMonthlyCapacities)
    .set({
      capacityHours: input.capacityHours,
      month: input.month,
    })
    .where(eq(memberMonthlyCapacities.id, id))
    .returning()
    .get();
}

export function deleteMemberMonthlyCapacity(db: KosuDatabase, id: string) {
  return db.delete(memberMonthlyCapacities).where(eq(memberMonthlyCapacities.id, id)).returning().get();
}
