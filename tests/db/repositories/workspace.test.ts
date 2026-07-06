// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../../app/db/client";
import {
  createWorkspace,
  findWorkspace,
  updateWorkspace,
} from "../../../app/db/repositories/workspace";

let db: ReturnType<typeof createDatabaseConnection>["db"];

beforeEach(() => {
  const connection = createDatabaseConnection(":memory:");
  db = connection.db;
  runMigrations(connection);
});

describe("workspace repository", () => {
  test("create and find workspace", () => {
    const created = createWorkspace(db, { displayName: "Acme", defaultTimezone: "Asia/Tokyo" });
    expect(created.displayName).toBe("Acme");

    const found = findWorkspace(db);
    expect(found?.defaultTimezone).toBe("Asia/Tokyo");
  });

  test("update workspace", () => {
    const created = createWorkspace(db, { displayName: "Acme", defaultTimezone: "Asia/Tokyo" });
    const updated = updateWorkspace(db, created.id, { displayName: "Acme Japan" });
    expect(updated.displayName).toBe("Acme Japan");
    expect(updated.defaultTimezone).toBe("Asia/Tokyo");
  });
});
