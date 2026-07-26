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

export { getMonthFromDate };
