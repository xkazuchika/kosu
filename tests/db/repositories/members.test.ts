// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import {
  activateMember,
  createMember,
  deactivateMember,
  findActiveMemberByEmail,
  findMemberByEmail,
  findMemberById,
  listMembers,
  updateMember,
} from "../../../app/db/repositories/members";
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

describe("members repository", () => {
  test("create and find member", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
      role: "admin",
      departmentName: "Engineering",
      hourlyCostRate: 5000,
    });

    expect(member.email).toBe("taro@example.com");
    expect(member.role).toBe("admin");

    const foundById = findMemberById(db, member.id);
    expect(foundById?.displayName).toBe("Taro");

    const foundByEmail = findMemberByEmail(db, "taro@example.com");
    expect(foundByEmail?.hourlyCostRate).toBe(5000);
  });

  test("list members ordered by email", () => {
    createMember(db, { displayName: "B", email: "b@example.com", passwordHash: "hash" });
    createMember(db, { displayName: "A", email: "a@example.com", passwordHash: "hash" });

    const all = listMembers(db);
    expect(all.map((m) => m.email)).toEqual(["a@example.com", "b@example.com"]);
  });

  test("update member", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const updated = updateMember(db, member.id, { displayName: "Taro Updated" });
    expect(updated.displayName).toBe("Taro Updated");
  });

  test("deactivate and activate member", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    deactivateMember(db, member.id);
    expect(findActiveMemberByEmail(db, "taro@example.com")).toBeUndefined();

    activateMember(db, member.id);
    expect(findActiveMemberByEmail(db, "taro@example.com")?.isActive).toBe(true);
  });

  test("duplicate email throws", () => {
    createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    expect(() => createMember(db, { displayName: "Taro2", email: "taro@example.com", passwordHash: "hash" })).toThrow();
  });
});
