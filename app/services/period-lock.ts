import type { KosuDatabase } from "~/db/client";
import { findPeriodLockByMonth } from "~/db/repositories/period-locks";

export function isMonthLocked(db: KosuDatabase, month: string) {
  const lock = findPeriodLockByMonth(db, month);
  return lock?.isLocked ?? false;
}

export function requireUnlockedMonth(db: KosuDatabase, month: string) {
  if (isMonthLocked(db, month)) {
    throw new Response("月次ロックにより編集できません", { status: 423 });
  }
}

export function getMonthFromDate(dateString: string) {
  return dateString.slice(0, 7);
}
