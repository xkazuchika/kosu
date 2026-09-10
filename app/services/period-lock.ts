import type { KosuDatabase } from "~/db/client";
import {
  getMonthFromDate,
  getMonthlyCostCloseState,
  requireOpenMonth,
} from "~/services/monthly-cost-close";

export function isMonthLocked(db: KosuDatabase, month: string) {
  return getMonthlyCostCloseState(db, month).isProtected;
}

export function requireUnlockedMonth(db: KosuDatabase, month: string) {
  return requireOpenMonth(db, month);
}

export function runInUnlockedMonthTransaction<T>(
  db: KosuDatabase,
  month: string,
  operation: (tx: KosuDatabase) => T,
) {
  return db.transaction((transaction) => {
    const tx = transaction as unknown as KosuDatabase;
    requireUnlockedMonth(tx, month);
    return operation(tx);
  });
}

export { getMonthFromDate };
