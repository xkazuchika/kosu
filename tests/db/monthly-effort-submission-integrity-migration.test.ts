// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

const databases: Database.Database[] = [];
const priorMigrationNames = [
  "0000_init.sql",
  "0001_handy_famine.sql",
  "0002_long_agent_zero.sql",
  "0003_nostalgic_scourge.sql",
  "0004_modern_stephen_strange.sql",
  "0005_tough_lila_cheney.sql",
  "0006_abnormal_gauntlet.sql",
];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function migrationSql(name: string) {
  return readFileSync(
    path.join(process.cwd(), "drizzle", name),
    "utf8",
  ).replaceAll("--> statement-breakpoint", "");
}

function createPreIntegrityDatabase() {
  const database = new Database(":memory:");
  databases.push(database);
  for (const name of priorMigrationNames) database.exec(migrationSql(name));
  return database;
}

function applyIntegrityMigration(database: Database.Database) {
  database.transaction(() => {
    database.exec(migrationSql("0007_nasty_drax.sql"));
  })();
}

function insertMembers(database: Database.Database) {
  database.exec(`
    INSERT INTO members
      (id, display_name, email, password_hash, role, is_active, created_at, updated_at)
    VALUES
      ('member-1', 'Member', 'member@example.com', 'hash', 'member', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('admin-1', 'Admin', 'admin@example.com', 'hash', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `);
}

describe("monthly effort submission integrity migration", () => {
  test("preserves valid submission states, indexes, and actor foreign keys", () => {
    const database = createPreIntegrityDatabase();
    insertMembers(database);
    database.exec(`
      INSERT INTO monthly_effort_submissions
        (id, member_id, month, status, submitted_by_member_id, submitted_at,
         invalidated_by_member_id, invalidated_at, is_legacy_migration,
         created_at, updated_at)
      VALUES
        ('draft', 'member-1', '2026-01', 'draft', NULL, NULL,
         NULL, NULL, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('submitted', 'member-1', '2026-02', 'submitted', 'member-1',
         '2026-02-28T09:00:00.000Z', NULL, NULL, 0,
         '2026-02-28T09:00:00.000Z', '2026-02-28T09:00:00.000Z'),
        ('invalidated', 'member-1', '2026-03', 'draft', NULL, NULL,
         'admin-1', '2026-04-01T01:00:00.000Z', 0,
         '2026-03-31T09:00:00.000Z', '2026-04-01T01:00:00.000Z'),
        ('legacy', 'member-1', '2026-04', 'submitted', NULL,
         '2026-05-01T00:00:00.000Z', NULL, NULL, 1,
         '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z');
    `);

    applyIntegrityMigration(database);

    expect(
      database
        .prepare(
          `SELECT id, member_id, month, status, submitted_by_member_id,
                  submitted_at, invalidated_by_member_id, invalidated_at,
                  is_legacy_migration, created_at, updated_at
           FROM monthly_effort_submissions ORDER BY month`,
        )
        .all(),
    ).toEqual([
      {
        id: "draft",
        member_id: "member-1",
        month: "2026-01",
        status: "draft",
        submitted_by_member_id: null,
        submitted_at: null,
        invalidated_by_member_id: null,
        invalidated_at: null,
        is_legacy_migration: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "submitted",
        member_id: "member-1",
        month: "2026-02",
        status: "submitted",
        submitted_by_member_id: "member-1",
        submitted_at: "2026-02-28T09:00:00.000Z",
        invalidated_by_member_id: null,
        invalidated_at: null,
        is_legacy_migration: 0,
        created_at: "2026-02-28T09:00:00.000Z",
        updated_at: "2026-02-28T09:00:00.000Z",
      },
      {
        id: "invalidated",
        member_id: "member-1",
        month: "2026-03",
        status: "draft",
        submitted_by_member_id: null,
        submitted_at: null,
        invalidated_by_member_id: "admin-1",
        invalidated_at: "2026-04-01T01:00:00.000Z",
        is_legacy_migration: 0,
        created_at: "2026-03-31T09:00:00.000Z",
        updated_at: "2026-04-01T01:00:00.000Z",
      },
      {
        id: "legacy",
        member_id: "member-1",
        month: "2026-04",
        status: "submitted",
        submitted_by_member_id: null,
        submitted_at: "2026-05-01T00:00:00.000Z",
        invalidated_by_member_id: null,
        invalidated_at: null,
        is_legacy_migration: 1,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
      },
    ]);

    expect(
      database
        .prepare("PRAGMA index_list('monthly_effort_submissions')")
        .all()
        .map((row) => (row as { name: string }).name)
        .sort(),
    ).toEqual([
      "monthly_effort_submission_member_month_unique",
      "monthly_effort_submissions_invalidated_by_index",
      "monthly_effort_submissions_month_status_index",
      "monthly_effort_submissions_submitted_by_index",
      "sqlite_autoindex_monthly_effort_submissions_1",
    ]);
    expect(
      database
        .prepare("PRAGMA foreign_key_list('monthly_effort_submissions')")
        .all()
        .map((row) => (row as { from: string }).from)
        .sort(),
    ).toEqual([
      "invalidated_by_member_id",
      "member_id",
      "submitted_by_member_id",
    ]);
  });

  test("rejects malformed status and month writes without partial changes", () => {
    const database = createPreIntegrityDatabase();
    insertMembers(database);
    applyIntegrityMigration(database);

    expect(() =>
      database.transaction(() => {
        database
          .prepare(
            `INSERT INTO monthly_effort_submissions (id, member_id, month, status)
             VALUES (?, 'member-1', ?, ?)`,
          )
          .run("valid-before-error", "2026-05", "draft");
        database
          .prepare(
            `INSERT INTO monthly_effort_submissions (id, member_id, month, status)
             VALUES (?, 'member-1', ?, ?)`,
          )
          .run("invalid-status", "2026-06", "approved");
      })(),
    ).toThrow();
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM monthly_effort_submissions")
        .get(),
    ).toEqual({ count: 0 });

    const malformedMonths = [
      "2026-00",
      "2026-13",
      "2026-1",
      "abcd-01",
      "2026-aa",
    ];
    const insert = database.prepare(
      `INSERT INTO monthly_effort_submissions (id, member_id, month, status)
       VALUES (?, 'member-1', ?, 'draft')`,
    );
    for (const [index, month] of malformedMonths.entries()) {
      expect(() => insert.run(`invalid-month-${index}`, month)).toThrow();
    }

    insert.run("valid", "2026-07");
    expect(() =>
      database
        .prepare(
          "UPDATE monthly_effort_submissions SET month = ? WHERE id = 'valid'",
        )
        .run("2026-99"),
    ).toThrow();
    expect(
      database
        .prepare(
          "SELECT month, status FROM monthly_effort_submissions WHERE id = 'valid'",
        )
        .get(),
    ).toEqual({ month: "2026-07", status: "draft" });
  });

  test("rolls the migration back when a legacy row violates a new constraint", () => {
    const database = createPreIntegrityDatabase();
    insertMembers(database);
    database
      .prepare(
        `INSERT INTO monthly_effort_submissions (id, member_id, month, status)
         VALUES ('malformed', 'member-1', '2026-99', 'approved')`,
      )
      .run();

    expect(() => applyIntegrityMigration(database)).toThrow();

    expect(
      database
        .prepare(
          "SELECT id, month, status FROM monthly_effort_submissions WHERE id = 'malformed'",
        )
        .get(),
    ).toEqual({ id: "malformed", month: "2026-99", status: "approved" });
    expect(
      database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name = '__new_monthly_effort_submissions'`,
        )
        .get(),
    ).toBeUndefined();
  });
});
