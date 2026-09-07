import type { KosuDatabase } from "../../app/db/client";
import { upsertDailyAllocationPlan } from "../../app/db/repositories/daily-allocation-plans";

export function createDailyAllocationPlan(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
  planDate: string,
  plannedHours: number,
) {
  return upsertDailyAllocationPlan(db, {
    memberId,
    projectId,
    planDate,
    plannedHours,
  });
}
