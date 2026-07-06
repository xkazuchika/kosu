// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import { createMember } from "../../../app/db/repositories/members";
import { createSession, deleteSession, findSessionById } from "../../../app/db/repositories/sessions";
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

describe("sessions repository", () => {
  test("create and find session", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const session = createSession(db, { memberId: member.id, expiresAt: "2026-12-31T23:59:59Z" });
    const found = findSessionById(db, session.id);
    expect(found?.memberId).toBe(member.id);
  });

  test("delete session", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const session = createSession(db, { memberId: member.id, expiresAt: "2026-12-31T23:59:59Z" });
    deleteSession(db, session.id);
    expect(findSessionById(db, session.id)).toBeUndefined();
  });
});
