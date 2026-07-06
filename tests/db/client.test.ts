// @vitest-environment node

import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";

function tempDatabasePath() {
  const tmpDir = os.tmpdir();
  const dataDir = path.join(tmpDir, `kosu-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dataDir, { recursive: true });

  return resolveDatabaseConfig({ KOSU_DATA_DIR: dataDir }, dataDir).databasePath;
}

test("creates database file and runs migrations", () => {
  const databasePath = tempDatabasePath();
  const connection = createDatabaseConnection(databasePath);

  try {
    runMigrations(connection);
    expect(existsSync(databasePath)).toBe(true);

    const tables = connection.db.all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`);
    const names = tables.map((row) => row.name);
    expect(names).toContain("members");
    expect(names).toContain("projects");
  } finally {
    connection.sqlite.close();
  }
});
