import { and, asc, desc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import {
  monthlyCostCloseEvents,
  monthlyCostCloseProjectSnapshots,
  monthlyCostCloses,
} from "../schema";

export type MonthlyCostCloseStatus = "open" | "in_review" | "approved";
export type MonthlyCostCloseEventType =
  | "migration"
  | "entered_review"
  | "approved"
  | "reopened"
  | "cost_snapshot_corrected";

export function findMonthlyCostCloseByMonth(db: KosuDatabase, month: string) {
  return db.select().from(monthlyCostCloses).where(eq(monthlyCostCloses.month, month)).get();
}

export function listMonthlyCostCloses(db: KosuDatabase) {
  return db.select().from(monthlyCostCloses).orderBy(desc(monthlyCostCloses.month)).all();
}

export function getOrCreateMonthlyCostClose(db: KosuDatabase, month: string) {
  const existing = findMonthlyCostCloseByMonth(db, month);

  if (existing) {
    return existing;
  }

  return db
    .insert(monthlyCostCloses)
    .values({ id: createId(), month, status: "open" })
    .returning()
    .get();
}

export function updateMonthlyCostClose(
  db: KosuDatabase,
  id: string,
  input: {
    status: MonthlyCostCloseStatus;
    enteredReviewByMemberId?: string | null;
    enteredReviewAt?: string | null;
    approvedByMemberId?: string | null;
    approvedAt?: string | null;
    updatedAt: string;
  },
) {
  return db
    .update(monthlyCostCloses)
    .set(input)
    .where(eq(monthlyCostCloses.id, id))
    .returning()
    .get();
}

export function appendMonthlyCostCloseEvent(
  db: KosuDatabase,
  input: {
    closeId: string;
    eventType: MonthlyCostCloseEventType;
    actorMemberId?: string | null;
    previousStatus?: MonthlyCostCloseStatus | null;
    nextStatus?: MonthlyCostCloseStatus | null;
    reason?: string | null;
    targetType?: "monthly_plan" | "effort_allocation" | null;
    targetId?: string | null;
    previousHourlyCostRate?: number | null;
    nextHourlyCostRate?: number | null;
    occurredAt: string;
  },
) {
  return db
    .insert(monthlyCostCloseEvents)
    .values({
      id: createId(),
      closeId: input.closeId,
      eventType: input.eventType,
      actorMemberId: input.actorMemberId ?? null,
      previousStatus: input.previousStatus ?? null,
      nextStatus: input.nextStatus ?? null,
      reason: input.reason ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      previousHourlyCostRate: input.previousHourlyCostRate ?? null,
      nextHourlyCostRate: input.nextHourlyCostRate ?? null,
      occurredAt: input.occurredAt,
    })
    .returning()
    .get();
}

export function listMonthlyCostCloseEvents(db: KosuDatabase, closeId: string) {
  return db
    .select()
    .from(monthlyCostCloseEvents)
    .where(eq(monthlyCostCloseEvents.closeId, closeId))
    .orderBy(asc(monthlyCostCloseEvents.occurredAt), asc(monthlyCostCloseEvents.createdAt))
    .all();
}

export type MonthlyCostCloseProjectSnapshotInsert = Omit<
  typeof monthlyCostCloseProjectSnapshots.$inferInsert,
  "id" | "createdAt"
>;

export function createMonthlyCostCloseProjectSnapshot(
  db: KosuDatabase,
  input: MonthlyCostCloseProjectSnapshotInsert,
) {
  return db
    .insert(monthlyCostCloseProjectSnapshots)
    .values({ id: createId(), ...input })
    .returning()
    .get();
}

export function listMonthlyCostCloseProjectSnapshots(db: KosuDatabase, closeId: string) {
  return db
    .select()
    .from(monthlyCostCloseProjectSnapshots)
    .where(eq(monthlyCostCloseProjectSnapshots.closeId, closeId))
    .orderBy(asc(monthlyCostCloseProjectSnapshots.projectCode))
    .all();
}

export function deleteMonthlyCostCloseProjectSnapshots(db: KosuDatabase, closeId: string) {
  return db
    .delete(monthlyCostCloseProjectSnapshots)
    .where(eq(monthlyCostCloseProjectSnapshots.closeId, closeId))
    .run();
}

export function findMonthlyCostCloseProjectSnapshot(
  db: KosuDatabase,
  closeId: string,
  projectId: string,
) {
  return db
    .select()
    .from(monthlyCostCloseProjectSnapshots)
    .where(
      and(
        eq(monthlyCostCloseProjectSnapshots.closeId, closeId),
        eq(monthlyCostCloseProjectSnapshots.projectId, projectId),
      ),
    )
    .get();
}
