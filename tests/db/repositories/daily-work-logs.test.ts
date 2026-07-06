// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import {
  createDailyWorkLog,
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
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-05", totalWorkingHours: 8 });

    const found = findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-05");
    expect(found?.totalWorkingHours).toBe(8);
    expect(listDailyWorkLogsByMember(db, member.id)).toHaveLength(1);
  });

  test("duplicate member and date throws", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-05", totalWorkingHours: 8 });

    expect(() => createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-05", totalWorkingHours: 7 })).toThrow();
  });
});
