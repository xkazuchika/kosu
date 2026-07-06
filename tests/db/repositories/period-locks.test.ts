// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import { createMember } from "../../../app/db/repositories/members";
import { findPeriodLockByMonth, lockPeriod, unlockPeriod } from "../../../app/db/repositories/period-locks";
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

describe("period locks repository", () => {
  test("lock and unlock period", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    lockPeriod(db, "2026-07", member.id, "2026-07-31T00:00:00Z");
    expect(findPeriodLockByMonth(db, "2026-07")?.isLocked).toBe(true);

    unlockPeriod(db, "2026-07", member.id, "2026-08-01T00:00:00Z");
    expect(findPeriodLockByMonth(db, "2026-07")?.isLocked).toBe(false);
  });

  test("re-locking updates existing row", () => {
    const member1 = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const member2 = createMember(db, { displayName: "Jiro", email: "jiro@example.com", passwordHash: "hash" });

    lockPeriod(db, "2026-07", member1.id, "2026-07-31T00:00:00Z");
    lockPeriod(db, "2026-07", member2.id, "2026-08-01T00:00:00Z");

    const lock = findPeriodLockByMonth(db, "2026-07");
    expect(lock?.isLocked).toBe(true);
    expect(lock?.lockedByMemberId).toBe(member2.id);
  });
});
