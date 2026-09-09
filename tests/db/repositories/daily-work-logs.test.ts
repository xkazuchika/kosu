// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import {
  createDailyWorkLog,
  deleteDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
  listDailyWorkLogsByMember,
} from "../../../app/db/repositories/daily-work-logs";
import { createMember } from "../../../app/db/repositories/members";
import { createTestDatabase } from "../../db/helpers";

let db: KosuDatabase;
let connection: DatabaseConnection;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

describe("daily work logs repository", () => {
  test("create and find work log", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
    });
    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-05",
      totalWorkingHours: 8,
    });

    const found = findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-05");
    expect(found?.totalWorkingHours).toBe(8);
    expect(listDailyWorkLogsByMember(db, member.id)).toHaveLength(1);
  });

  test("duplicate member and date throws", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
    });
    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-05",
      totalWorkingHours: 8,
    });

    expect(() =>
      createDailyWorkLog(db, {
        memberId: member.id,
        workDate: "2026-07-05",
        totalWorkingHours: 7,
      }),
    ).toThrow();
  });

  test("create reactivates a soft-deleted work log", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
    });
    const original = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-05",
      totalWorkingHours: 8,
    });
    deleteDailyWorkLog(db, original.id, "2026-07-06T00:00:00.000Z");

    const restored = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-05",
      totalWorkingHours: 7,
    });

    expect(restored.id).toBe(original.id);
    expect(restored.deletedAt).toBeNull();
    expect(restored.totalWorkingHours).toBe(7);
    expect(listDailyWorkLogsByMember(db, member.id)).toHaveLength(1);
  });
});
