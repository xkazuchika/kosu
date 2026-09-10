// @vitest-environment node

import { afterEach, beforeEach, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import {
  createDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
} from "../../app/db/repositories/daily-work-logs";
import { createMember } from "../../app/db/repositories/members";
import {
  getOrCreateMonthlyCostClose,
  updateMonthlyCostClose,
} from "../../app/db/repositories/monthly-cost-closes";
import {
  findMonthlyEffortSubmission,
  submitMonthlyEffortSubmission,
} from "../../app/db/repositories/monthly-effort-submissions";
import { invalidateMonthlyEffortSubmission } from "../../app/services/monthly-effort-submission";
import {
  requireUnlockedMonth,
  runInUnlockedMonthTransaction,
} from "../../app/services/period-lock";
import { createTestDatabase } from "../db/helpers";

let connection: DatabaseConnection;
let db: KosuDatabase;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

test("transaction guard rejects a month protected after preliminary validation", () => {
  const month = "2026-07";
  const member = createMember(db, {
    displayName: "Taro",
    email: "taro@example.com",
    passwordHash: "hash",
  });
  submitMonthlyEffortSubmission(db, {
    memberId: member.id,
    month,
    actorMemberId: member.id,
    submittedAt: "2026-08-01T00:00:00.000Z",
  });

  expect(requireUnlockedMonth(db, month).status).toBe("open");
  const close = getOrCreateMonthlyCostClose(db, month);
  updateMonthlyCostClose(db, close.id, {
    status: "in_review",
    updatedAt: "2026-08-01T00:01:00.000Z",
  });

  expect(() =>
    runInUnlockedMonthTransaction(db, month, (tx) => {
      createDailyWorkLog(tx, {
        memberId: member.id,
        workDate: "2026-07-31",
        totalWorkingHours: 8,
      });
      invalidateMonthlyEffortSubmission(tx, {
        memberId: member.id,
        month,
        actorMemberId: member.id,
      });
    }),
  ).toThrow(Response);
  expect(
    findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-31"),
  ).toBeUndefined();
  expect(findMonthlyEffortSubmission(db, member.id, month)?.status).toBe(
    "submitted",
  );
});
