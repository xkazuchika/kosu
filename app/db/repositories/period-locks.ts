import { desc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { periodLocks } from "../schema";

export type PeriodLockInsert = {
  month: string;
  isLocked?: boolean;
  lockedByMemberId?: string | null;
  lockedAt?: string | null;
};

export function findPeriodLockByMonth(db: KosuDatabase, month: string) {
  return db.select().from(periodLocks).where(eq(periodLocks.month, month)).get();
}

export function listPeriodLocks(db: KosuDatabase) {
  return db.select().from(periodLocks).orderBy(desc(periodLocks.month)).all();
}

export function createPeriodLock(db: KosuDatabase, input: PeriodLockInsert) {
  return db
    .insert(periodLocks)
    .values({
      id: createId(),
      month: input.month,
      isLocked: input.isLocked ?? true,
      lockedByMemberId: input.lockedByMemberId ?? null,
      lockedAt: input.lockedAt ?? null,
    })
    .returning()
    .get();
}

export function lockPeriod(db: KosuDatabase, month: string, lockedByMemberId: string, lockedAt: string) {
  const existing = findPeriodLockByMonth(db, month);

  if (existing) {
    return db
      .update(periodLocks)
      .set({ isLocked: true, lockedByMemberId, lockedAt, unlockedByMemberId: null, unlockedAt: null })
      .where(eq(periodLocks.id, existing.id))
      .returning()
      .get();
  }

  return createPeriodLock(db, { month, isLocked: true, lockedByMemberId, lockedAt });
}

export function unlockPeriod(db: KosuDatabase, month: string, unlockedByMemberId: string, unlockedAt: string) {
  const existing = findPeriodLockByMonth(db, month);

  if (!existing) {
    return undefined;
  }

  return db
    .update(periodLocks)
    .set({ isLocked: false, unlockedByMemberId, unlockedAt })
    .where(eq(periodLocks.id, existing.id))
    .returning()
    .get();
}
