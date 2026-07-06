// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import {
  createMemberMonthlyCapacity,
  findCapacityByMemberAndMonth,
  listCapacitiesByMember,
  updateMemberMonthlyCapacity,
} from "../../../app/db/repositories/member-monthly-capacities";
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

describe("member monthly capacities repository", () => {
  test("create and find capacity", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    createMemberMonthlyCapacity(db, { memberId: member.id, month: "2026-07", capacityHours: 160 });

    const found = findCapacityByMemberAndMonth(db, member.id, "2026-07");
    expect(found?.capacityHours).toBe(160);
    expect(listCapacitiesByMember(db, member.id)).toHaveLength(1);
  });

  test("update capacity", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const capacity = createMemberMonthlyCapacity(db, { memberId: member.id, month: "2026-07", capacityHours: 160 });

    const updated = updateMemberMonthlyCapacity(db, capacity.id, { capacityHours: 120 });
    expect(updated.capacityHours).toBe(120);
  });

  test("duplicate member and month throws", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    createMemberMonthlyCapacity(db, { memberId: member.id, month: "2026-07", capacityHours: 160 });

    expect(() => createMemberMonthlyCapacity(db, { memberId: member.id, month: "2026-07", capacityHours: 120 })).toThrow();
  });
});
