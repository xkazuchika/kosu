import {
  getOrCreateMonthlyCostClose,
  updateMonthlyCostClose,
} from "../../app/db/repositories/monthly-cost-closes";
import type { KosuDatabase } from "../../app/db/client";
import { upsertDailyAllocationPlan } from "../../app/db/repositories/daily-allocation-plans";

export function createDailyAllocationPlan(
  db: KosuDatabase,
  input: {
    memberId: string;
    projectId: string;
    planDate: string;
    plannedHours: number;
  },
) {
  return upsertDailyAllocationPlan(db, input);
}

/** Fixture for writer protection tests, independent of lifecycle prerequisites. */
export function setEffortConfirmed(
  db: KosuDatabase,
  input: { month: string; actorMemberId: string },
) {
  const close = getOrCreateMonthlyCostClose(db, input.month);
  updateMonthlyCostClose(db, close.id, {
    effortStatus: "confirmed",
    effortConfirmedByMemberId: input.actorMemberId,
    effortConfirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
