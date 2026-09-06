// @vitest-environment node

import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import {
  defaultBusyTimeoutMs,
  resolveBusyTimeoutMs,
  resolveDatabaseConfig,
} from "../../app/db/config";
import { createTestDatabase } from "./helpers";

function tempDatabasePath() {
  const tmpDir = os.tmpdir();
  const dataDir = path.join(
    tmpDir,
    `kosu-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dataDir, { recursive: true });

  return resolveDatabaseConfig({ KOSU_DATA_DIR: dataDir }, dataDir)
    .databasePath;
}

test("creates database file and runs migrations", () => {
  const databasePath = tempDatabasePath();
  const connection = createDatabaseConnection(databasePath);

  try {
    runMigrations(connection);
    expect(existsSync(databasePath)).toBe(true);

    const tables = connection.db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = tables.map((row) => row.name);
    expect(names).toContain("members");
    expect(names).toContain("projects");
  } finally {
    connection.sqlite.close();
  }
});

test("enables foreign keys, WAL, and busy timeout on each connection", () => {
  const databasePath = tempDatabasePath();
  const connection = createDatabaseConnection(databasePath);

  try {
    expect(connection.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(connection.sqlite.pragma("journal_mode", { simple: true })).toBe(
      "wal",
    );
    expect(connection.sqlite.pragma("busy_timeout", { simple: true })).toBe(
      defaultBusyTimeoutMs,
    );
  } finally {
    connection.sqlite.close();
  }
});

test("busy timeout uses the configured default when the environment variable is absent", () => {
  expect(resolveBusyTimeoutMs({})).toBe(defaultBusyTimeoutMs);
  expect(resolveBusyTimeoutMs({ KOSU_SQLITE_BUSY_TIMEOUT_MS: "  " })).toBe(
    defaultBusyTimeoutMs,
  );
});

test("busy timeout accepts an explicit environment override", () => {
  expect(resolveBusyTimeoutMs({ KOSU_SQLITE_BUSY_TIMEOUT_MS: "15000" })).toBe(
    15000,
  );
});

test("busy timeout falls back to the default for invalid environment values", () => {
  expect(resolveBusyTimeoutMs({ KOSU_SQLITE_BUSY_TIMEOUT_MS: "abc" })).toBe(
    defaultBusyTimeoutMs,
  );
  expect(resolveBusyTimeoutMs({ KOSU_SQLITE_BUSY_TIMEOUT_MS: "-1" })).toBe(
    defaultBusyTimeoutMs,
  );
  expect(resolveBusyTimeoutMs({ KOSU_SQLITE_BUSY_TIMEOUT_MS: "1.5" })).toBe(
    defaultBusyTimeoutMs,
  );
});

test("rejects writes that violate foreign key constraints", () => {
  const connection = createTestDatabase();

  try {
    const memberId = insertMember(connection, "fk-member@example.com");
    insertProject(connection, "FK-1");
    const workLogId = insertWorkLog(connection, memberId, "2026-01-05");

    expect(() =>
      insertAllocation(connection, {
        workLogId,
        memberId,
        projectId: "missing-project",
      }),
    ).toThrow();
  } finally {
    connection.sqlite.close();
  }
});

test("cascades member deletion to dependent rows once foreign keys are enforced", () => {
  const connection = createTestDatabase();

  try {
    const memberId = insertMember(connection, "fk-cascade@example.com");
    const projectId = insertProject(connection, "FK-2");
    const workLogId = insertWorkLog(connection, memberId, "2026-01-06");
    insertAllocation(connection, { workLogId, memberId, projectId });

    connection.sqlite.prepare("DELETE FROM members WHERE id = ?").run(memberId);

    const remainingWorkLogs = connection.sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM daily_work_logs WHERE member_id = ?",
      )
      .get(memberId) as { count: number };
    expect(remainingWorkLogs.count).toBe(0);
  } finally {
    connection.sqlite.close();
  }
});

test("restricts project deletion while a close snapshot references it", () => {
  const connection = createTestDatabase();

  try {
    const projectId = insertProject(connection, "FK-3");
    const now = new Date().toISOString();

    connection.sqlite
      .prepare(
        `INSERT INTO monthly_cost_closes (id, month, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("close-1", "2026-01", "approved", now, now);

    connection.sqlite
      .prepare(
        `INSERT INTO monthly_cost_close_project_snapshots
         (id, close_id, project_id, project_code, project_name, project_type, project_is_archived,
          monthly_planned_cost, monthly_actual_cost, cumulative_actual_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "snapshot-1",
        "close-1",
        projectId,
        "FK-3",
        "Restricted project",
        "billable",
        0,
        0,
        0,
        0,
        now,
      );

    expect(() =>
      connection.sqlite
        .prepare("DELETE FROM projects WHERE id = ?")
        .run(projectId),
    ).toThrow(/FOREIGN KEY/);
  } finally {
    connection.sqlite.close();
  }
});

function insertMember(
  connection: ReturnType<typeof createDatabaseConnection>,
  email: string,
) {
  const id = `member-${email}`;
  const now = new Date().toISOString();
  connection.sqlite
    .prepare(
      `INSERT INTO members (id, display_name, email, password_hash, role, is_active, hourly_cost_rate, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, "FK Member", email, "hash", "member", 1, 5000, now, now);

  return id;
}

function insertProject(
  connection: ReturnType<typeof createDatabaseConnection>,
  code: string,
) {
  const id = `project-${code}`;
  const now = new Date().toISOString();
  connection.sqlite
    .prepare(
      `INSERT INTO projects (id, code, name, project_type, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, code, `Project ${code}`, "billable", 0, now, now);

  return id;
}

function insertWorkLog(
  connection: ReturnType<typeof createDatabaseConnection>,
  memberId: string,
  workDate: string,
) {
  const id = `work-log-${workDate}`;
  const now = new Date().toISOString();
  connection.sqlite
    .prepare(
      `INSERT INTO daily_work_logs (id, member_id, work_date, total_working_hours, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, memberId, workDate, 8, now, now);

  return id;
}

function insertAllocation(
  connection: ReturnType<typeof createDatabaseConnection>,
  input: { workLogId: string; memberId: string; projectId: string },
) {
  const now = new Date().toISOString();
  connection.sqlite
    .prepare(
      `INSERT INTO effort_allocations (id, daily_work_log_id, member_id, project_id, allocated_hours, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `allocation-${input.workLogId}`,
      input.workLogId,
      input.memberId,
      input.projectId,
      8,
      now,
      now,
    );
}
