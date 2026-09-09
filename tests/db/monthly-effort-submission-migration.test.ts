// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

const databases: Database.Database[] = [];
const migrationNames = [
  "0000_init.sql",
  "0001_handy_famine.sql",
  "0002_long_agent_zero.sql",
  "0003_nostalgic_scourge.sql",
  "0004_modern_stephen_strange.sql",
  "0005_tough_lila_cheney.sql",
];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createPreSubmissionDatabase() {
  const database = new Database(":memory:");
  databases.push(database);
  for (const name of migrationNames) {
    database.exec(
      readFileSync(
        path.join(process.cwd(), "drizzle", name),
        "utf8",
      ).replaceAll("--> statement-breakpoint", ""),
    );
  }
  return database;
}

function submissionMigrationSql() {
  return readFileSync(
    path.join(process.cwd(), "drizzle", "0006_abnormal_gauntlet.sql"),
    "utf8",
  ).replaceAll("--> statement-breakpoint", "");
}

describe("monthly effort submission migration", () => {
  test("creates the table on a fresh upgraded database", () => {
    const database = createPreSubmissionDatabase();

    database.exec(submissionMigrationSql());

    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'monthly_effort_submissions'",
        )
        .get(),
    ).toEqual({ name: "monthly_effort_submissions" });
  });

  test("backfills required members only for protected legacy months", () => {
    const database = createPreSubmissionDatabase();
    database.exec(`
      INSERT INTO members
        (id, display_name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES
        ('active-old', 'Active old', 'old@example.com', 'hash', 'member', 1, '2026-06-01T00:00:00.000Z', CURRENT_TIMESTAMP),
        ('active-new', 'Active new', 'new@example.com', 'hash', 'member', 1, '2026-08-01T00:00:00.000Z', CURRENT_TIMESTAMP),
        ('inactive-evidence', 'Inactive', 'inactive@example.com', 'hash', 'member', 0, '2026-06-01T00:00:00.000Z', CURRENT_TIMESTAMP);
      INSERT INTO member_monthly_capacities
        (id, member_id, month, capacity_hours, created_at, updated_at)
      VALUES
        ('capacity-1', 'inactive-evidence', '2026-07', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('capacity-2', 'inactive-evidence', '2026-08', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO monthly_cost_closes
        (id, month, status, entered_review_at, approved_at, created_at, updated_at)
      VALUES
        ('close-protected', '2026-07', 'approved', '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('close-open', '2026-08', 'open', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    database.exec(submissionMigrationSql());

    expect(
      database
        .prepare(
          `SELECT member_id, month, status, submitted_by_member_id,
                  submitted_at, is_legacy_migration
           FROM monthly_effort_submissions ORDER BY member_id`,
        )
        .all(),
    ).toEqual([
      {
        member_id: "active-old",
        month: "2026-07",
        status: "submitted",
        submitted_by_member_id: null,
        submitted_at: "2026-08-02T00:00:00.000Z",
        is_legacy_migration: 1,
      },
      {
        member_id: "inactive-evidence",
        month: "2026-07",
        status: "submitted",
        submitted_by_member_id: null,
        submitted_at: "2026-08-02T00:00:00.000Z",
        is_legacy_migration: 1,
      },
    ]);
  });

  test("keeps the backfill idempotent and leaves existing rows unchanged", () => {
    const database = createPreSubmissionDatabase();
    database.exec(`
      INSERT INTO members
        (id, display_name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ('member-1', 'Member', 'member@example.com', 'hash', 'member', 1, '2026-06-01T00:00:00.000Z', CURRENT_TIMESTAMP);
      INSERT INTO monthly_cost_closes
        (id, month, status, entered_review_at, created_at, updated_at)
      VALUES ('close-1', '2026-07', 'in_review', '2026-08-01T00:00:00.000Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);
    const migration = submissionMigrationSql();
    database.exec(migration);
    const backfill = migration.slice(migration.indexOf("INSERT OR IGNORE"));

    database.exec(backfill);

    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM monthly_effort_submissions")
        .get(),
    ).toEqual({ count: 1 });
  });

  test("leaves existing close and effort tables intact for older-code rollback", () => {
    const database = createPreSubmissionDatabase();
    database.exec(submissionMigrationSql());

    expect(
      database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name IN ('daily_work_logs', 'monthly_cost_closes')
           ORDER BY name`,
        )
        .all(),
    ).toEqual([{ name: "daily_work_logs" }, { name: "monthly_cost_closes" }]);
  });
});
