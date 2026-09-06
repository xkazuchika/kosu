// @vitest-environment node

import { beforeEach, afterEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import type { KosuDatabase } from "../../app/db/client";
import { findMemberByEmail } from "../../app/db/repositories/members";
import { commitImport } from "../../app/services/import";
import { setupWorkspace } from "../../app/services/auth";

let db: KosuDatabase;
let connection: ReturnType<typeof createDatabaseConnection>;

beforeEach(async () => {
  connection = createDatabaseConnection(":memory:");
  db = connection.db;
  runMigrations(connection);
  await setupWorkspace(db, {
    workspaceName: "Acme",
    defaultTimezone: "Asia/Tokyo",
    administratorName: "Admin",
    administratorEmail: "admin@example.com",
    administratorPassword: "password123",
  });
});

afterEach(() => {
  connection.sqlite.close();
});

const memberHeader = ["email", "displayName", "role", "departmentName", "hourlyCostRate", "isActive"];

describe("import commit atomicity", () => {
  test("commits all valid rows together", async () => {
    const result = await commitImport(
      db,
      "members",
      [memberHeader, ["new1@example.com", "New 1", "member", "", "", "true"], ["new2@example.com", "New 2", "member", "", "", "true"]],
      "testpass123",
      "actor",
    );

    expect(result).toEqual({ imported: 2, failed: 0, createdByMemberId: "actor" });
    expect(findMemberByEmail(db, "new1@example.com")).toBeDefined();
    expect(findMemberByEmail(db, "new2@example.com")).toBeDefined();
  });

  test("fails without persisting any rows when an apply error occurs mid-import", async () => {
    const result = await commitImport(
      db,
      "members",
      [memberHeader, ["new1@example.com", "New 1", "member", "", "", "true"], ["new2@example.com", "New 2", "member", "", "", "true"]],
      undefined,
      "actor",
    );

    expect(result).toEqual({ imported: 0, failed: 2, createdByMemberId: "actor" });
    expect(findMemberByEmail(db, "new1@example.com")).toBeUndefined();
    expect(findMemberByEmail(db, "new2@example.com")).toBeUndefined();
  });
});
