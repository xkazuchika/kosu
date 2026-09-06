// @vitest-environment node

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import {
  findForeignKeyViolations,
  formatForeignKeyViolations,
} from "../../app/db/integrity";

function tempDatabasePath() {
  const tmpDir = os.tmpdir();
  const dataDir = path.join(
    tmpDir,
    `kosu-integrity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dataDir, { recursive: true });

  return resolveDatabaseConfig({ KOSU_DATA_DIR: dataDir }, dataDir)
    .databasePath;
}

function insertOrphanAllocation(databasePath: string) {
  const raw = new Database(databasePath);
  raw.pragma("foreign_keys = OFF");

  try {
    const now = new Date().toISOString();

    raw
      .prepare(
        `INSERT INTO members (id, display_name, email, password_hash, role, is_active, hourly_cost_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "orphan-member",
        "Orphan Member",
        "orphan@example.com",
        "hash",
        "member",
        1,
        5000,
        now,
        now,
      );

    raw
      .prepare(
        `INSERT INTO projects (id, code, name, project_type, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "orphan-project",
        "ORPHAN-1",
        "Orphan project",
        "billable",
        0,
        now,
        now,
      );

    raw
      .prepare(
        `INSERT INTO effort_allocations (id, daily_work_log_id, member_id, project_id, allocated_hours, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "orphan-allocation",
        "missing-work-log",
        "orphan-member",
        "orphan-project",
        4,
        now,
        now,
      );
  } finally {
    raw.close();
  }
}

test("returns no violations for a freshly migrated database", () => {
  const databasePath = tempDatabasePath();
  const connection = createDatabaseConnection(databasePath);

  try {
    runMigrations(connection);
    expect(findForeignKeyViolations(connection)).toEqual([]);
  } finally {
    connection.sqlite.close();
  }
});

test("reports orphaned rows by table and parent table with counts", () => {
  const databasePath = tempDatabasePath();
  const seeded = createDatabaseConnection(databasePath);
  runMigrations(seeded);
  seeded.sqlite.close();

  insertOrphanAllocation(databasePath);

  const connection = createDatabaseConnection(databasePath);

  try {
    const violations = findForeignKeyViolations(connection);
    expect(violations).toHaveLength(1);
    expect(violations[0].table).toBe("effort_allocations");
    expect(violations[0].parentTable).toBe("daily_work_logs");
    expect(violations[0].count).toBe(1);
  } finally {
    connection.sqlite.close();
  }
});

test("formats violations with table names, counts, and repair guidance", () => {
  const message = formatForeignKeyViolations([
    { table: "effort_allocations", parentTable: "daily_work_logs", count: 3 },
  ]);

  expect(message).toContain("effort_allocations -> daily_work_logs: 3 件");
  expect(message).toContain("PRAGMA foreign_key_check");
});

function runCheckScript(databasePath: string) {
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/check-foreign-keys.ts", databasePath],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return {
    status: result.status ?? 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

test("check script passes for a consistent database", () => {
  const databasePath = tempDatabasePath();
  const connection = createDatabaseConnection(databasePath);
  runMigrations(connection);
  connection.sqlite.close();

  const result = runCheckScript(databasePath);

  expect(result.status).toBe(0);
  expect(result.output).toContain("検査に合格");
});

test("check script aborts with a non-zero exit code when violations exist", () => {
  const databasePath = tempDatabasePath();
  const seeded = createDatabaseConnection(databasePath);
  runMigrations(seeded);
  seeded.sqlite.close();

  insertOrphanAllocation(databasePath);

  const result = runCheckScript(databasePath);

  expect(result.status).toBe(1);
  expect(result.output).toContain("外部キー制約に違反");
  expect(result.output).toContain("effort_allocations");
});

test("check script skips when the database file does not exist yet", () => {
  const missingPath = path.join(
    os.tmpdir(),
    `kosu-missing-${Date.now()}`,
    "kosu.sqlite",
  );

  const result = runCheckScript(missingPath);

  expect(result.status).toBe(0);
  expect(result.output).toContain("スキップ");
});
