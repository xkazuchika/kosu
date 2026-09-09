// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createMemberMonthlyCapacity } from "../../app/db/repositories/member-monthly-capacities";
import {
  createMember,
  deactivateMember,
} from "../../app/db/repositories/members";
import {
  findMonthlyEffortSubmission,
  invalidateSubmittedMonthlyEffort,
} from "../../app/db/repositories/monthly-effort-submissions";
import {
  getOrCreateMonthlyCostClose,
  updateMonthlyCostClose,
} from "../../app/db/repositories/monthly-cost-closes";
import { members } from "../../app/db/schema";
import {
  getMonthlyEffortSubmissionSummary,
  invalidateMonthlyEffortSubmission,
  listRequiredMonthlyEffortMembers,
  MonthlyEffortSubmissionError,
  submitMonthlyEffort,
} from "../../app/services/monthly-effort-submission";
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

function createActors() {
  const admin = createMember(db, {
    displayName: "Admin",
    email: "admin@example.com",
    passwordHash: "hash",
    role: "admin",
  });
  const member = createMember(db, {
    displayName: "Taro",
    email: "taro@example.com",
    passwordHash: "hash",
  });
  const other = createMember(db, {
    displayName: "Jiro",
    email: "jiro@example.com",
    passwordHash: "hash",
  });
  return { admin, member, other };
}

describe("required monthly effort members", () => {
  test("uses creation month and deduplicates all month evidence", () => {
    const { member, other } = createActors();
    db.update(members)
      .set({ createdAt: "2026-10-01T00:00:00.000Z" })
      .where(eq(members.id, other.id))
      .run();
    deactivateMember(db, member.id);
    createMemberMonthlyCapacity(db, {
      memberId: member.id,
      month: "2026-09",
      capacityHours: 0,
    });
    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-09-15",
      totalWorkingHours: 0,
    });

    const required = listRequiredMonthlyEffortMembers(db, "2026-09");

    expect(required.map((entry) => entry.id)).toContain(member.id);
    expect(required.map((entry) => entry.id)).not.toContain(other.id);
    expect(required.filter((entry) => entry.id === member.id)).toHaveLength(1);
  });

  test("includes an active member with no logs so zero hours require explicit submission", () => {
    const { member } = createActors();

    expect(
      listRequiredMonthlyEffortMembers(db, "2026-09").map((entry) => entry.id),
    ).toContain(member.id);
    expect(getMonthlyEffortSubmissionSummary(db, "2026-09")).toMatchObject({
      requiredCount: 3,
      submittedCount: 0,
      draftCount: 3,
      allSubmitted: false,
    });
  });
});

describe("monthly effort submission", () => {
  test("allows own balanced and zero-hour submissions", () => {
    const { member } = createActors();

    const submitted = submitMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-09",
      actorMemberId: member.id,
      occurredAt: "2026-10-01T00:00:00.000Z",
    });

    expect(submitted).toMatchObject({
      status: "submitted",
      memberId: member.id,
      submittedByMemberId: member.id,
    });
  });

  test("denies cross-member submission but allows an administrator proxy", () => {
    const { admin, member, other } = createActors();

    expect(() =>
      submitMonthlyEffort(db, {
        memberId: other.id,
        month: "2026-09",
        actorMemberId: member.id,
      }),
    ).toThrow(Response);

    expect(
      submitMonthlyEffort(db, {
        memberId: other.id,
        month: "2026-09",
        actorMemberId: admin.id,
      }),
    ).toMatchObject({ submittedByMemberId: admin.id, memberId: other.id });
  });

  test("allows an administrator to submit for an inactive member with evidence", () => {
    const { admin, member } = createActors();
    deactivateMember(db, member.id);
    createMemberMonthlyCapacity(db, {
      memberId: member.id,
      month: "2026-09",
      capacityHours: 0,
    });

    expect(
      submitMonthlyEffort(db, {
        memberId: member.id,
        month: "2026-09",
        actorMemberId: admin.id,
      }),
    ).toMatchObject({ status: "submitted", submittedByMemberId: admin.id });
  });

  test("returns every unbalanced date and does not persist a rejected submission", () => {
    const { member } = createActors();
    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-09-10",
      totalWorkingHours: 8,
    });
    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-09-11",
      totalWorkingHours: 4,
    });

    let caught: unknown;
    try {
      submitMonthlyEffort(db, {
        memberId: member.id,
        month: "2026-09",
        actorMemberId: member.id,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MonthlyEffortSubmissionError);
    expect((caught as MonthlyEffortSubmissionError).unbalancedDates).toEqual([
      "2026-09-10",
      "2026-09-11",
    ]);
    expect(
      findMonthlyEffortSubmission(db, member.id, "2026-09"),
    ).toBeUndefined();
  });

  test("rejects protected months", () => {
    const { admin, member } = createActors();
    const close = getOrCreateMonthlyCostClose(db, "2026-09");
    updateMonthlyCostClose(db, close.id, {
      status: "in_review",
      enteredReviewByMemberId: admin.id,
      enteredReviewAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });

    expect(() =>
      submitMonthlyEffort(db, {
        memberId: member.id,
        month: "2026-09",
        actorMemberId: member.id,
      }),
    ).toThrow(Response);
  });

  test("invalidates submitted state once and leaves draft state idempotent", () => {
    const { admin, member } = createActors();
    submitMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-09",
      actorMemberId: member.id,
    });

    expect(
      invalidateMonthlyEffortSubmission(db, {
        memberId: member.id,
        month: "2026-09",
        actorMemberId: admin.id,
        occurredAt: "2026-10-02T00:00:00.000Z",
      }),
    ).toMatchObject({ status: "draft", invalidatedByMemberId: admin.id });
    expect(
      invalidateSubmittedMonthlyEffort(db, {
        memberId: member.id,
        month: "2026-09",
        actorMemberId: member.id,
        invalidatedAt: "2026-10-03T00:00:00.000Z",
      }),
    ).toBeUndefined();
    expect(findMonthlyEffortSubmission(db, member.id, "2026-09")).toMatchObject(
      {
        invalidatedByMemberId: admin.id,
        invalidatedAt: "2026-10-02T00:00:00.000Z",
      },
    );
  });

  test("rolls back submission when persistence fails", () => {
    const { member } = createActors();
    connection.sqlite.exec(`
      CREATE TRIGGER reject_monthly_effort_submission
      BEFORE INSERT ON monthly_effort_submissions
      BEGIN
        SELECT RAISE(ABORT, 'submission rejected');
      END;
    `);

    expect(() =>
      submitMonthlyEffort(db, {
        memberId: member.id,
        month: "2026-09",
        actorMemberId: member.id,
      }),
    ).toThrow("submission rejected");
    expect(
      findMonthlyEffortSubmission(db, member.id, "2026-09"),
    ).toBeUndefined();
  });
});
