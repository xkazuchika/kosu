// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../../app/db/client";
import { createMember } from "../../../app/db/repositories/members";
import {
  findMonthlyEffortSubmission,
  invalidateSubmittedMonthlyEffort,
  listMonthlyEffortSubmissionsByMonth,
  submitMonthlyEffortSubmission,
} from "../../../app/db/repositories/monthly-effort-submissions";
import { getMonthlyEffortSubmissionState } from "../../../app/services/monthly-effort-submission";
import { createTestDatabase } from "../../db/helpers";

let connection: DatabaseConnection;
let db: KosuDatabase;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

describe("monthly effort submissions repository", () => {
  test("treats an absent row as draft and keeps one row per member and month", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
    });

    expect(
      getMonthlyEffortSubmissionState(db, member.id, "2026-09"),
    ).toMatchObject({
      status: "draft",
      submittedAt: null,
    });

    submitMonthlyEffortSubmission(db, {
      memberId: member.id,
      month: "2026-09",
      actorMemberId: member.id,
      submittedAt: "2026-10-01T00:00:00.000Z",
    });
    submitMonthlyEffortSubmission(db, {
      memberId: member.id,
      month: "2026-09",
      actorMemberId: member.id,
      submittedAt: "2026-10-01T01:00:00.000Z",
    });

    expect(listMonthlyEffortSubmissionsByMonth(db, "2026-09")).toHaveLength(1);
    expect(findMonthlyEffortSubmission(db, member.id, "2026-09")).toMatchObject(
      {
        status: "submitted",
        submittedByMemberId: member.id,
        submittedAt: "2026-10-01T01:00:00.000Z",
      },
    );
  });

  test("records a proxy actor and invalidation metadata", () => {
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
    submitMonthlyEffortSubmission(db, {
      memberId: member.id,
      month: "2026-09",
      actorMemberId: admin.id,
      submittedAt: "2026-10-01T00:00:00.000Z",
    });

    invalidateSubmittedMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-09",
      actorMemberId: admin.id,
      invalidatedAt: "2026-10-02T00:00:00.000Z",
    });

    expect(findMonthlyEffortSubmission(db, member.id, "2026-09")).toMatchObject(
      {
        status: "draft",
        submittedByMemberId: null,
        submittedAt: null,
        invalidatedByMemberId: admin.id,
        invalidatedAt: "2026-10-02T00:00:00.000Z",
      },
    );
  });
});
