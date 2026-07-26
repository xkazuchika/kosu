// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createLegacyDatabase() {
  const database = new Database(":memory:");
  databases.push(database);

  for (const name of ["0000_init.sql", "0001_handy_famine.sql", "0002_long_agent_zero.sql"]) {
    database.exec(readFileSync(path.join(process.cwd(), "drizzle", name), "utf8"));
  }

  return database;
}

function applyMonthlyCloseMigration(database: Database.Database) {
  database.exec(readFileSync(path.join(process.cwd(), "drizzle", "0003_nostalgic_scourge.sql"), "utf8"));
}

describe("monthly cost close migration", () => {
  test("creates close, event, and project snapshot tables on a fresh legacy schema", () => {
    const database = createLegacyDatabase();
    applyMonthlyCloseMigration(database);

    const tableNames = database
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tableNames).toEqual(expect.arrayContaining([
      "monthly_cost_closes",
      "monthly_cost_close_events",
      "monthly_cost_close_project_snapshots",
    ]));
  });

  test("maps only active legacy locks to in-review and preserves actor and timestamp", () => {
    const database = createLegacyDatabase();
    database.prepare(`
      insert into members (id, display_name, email, password_hash, role, is_active)
      values ('admin-1', 'Admin', 'admin@example.com', 'hash', 'admin', 1)
    `).run();
    database.prepare(`
      insert into period_locks
        (id, month, is_locked, locked_by_member_id, locked_at, created_at, updated_at)
      values
        ('locked-1', '2026-06', 1, 'admin-1', '2026-07-01T09:00:00.000Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('open-1', '2026-07', 0, null, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    applyMonthlyCloseMigration(database);

    expect(database.prepare("select * from monthly_cost_closes order by month").all()).toMatchObject([
      {
        id: "legacy-close-locked-1",
        month: "2026-06",
        status: "in_review",
        entered_review_by_member_id: "admin-1",
        entered_review_at: "2026-07-01T09:00:00.000Z",
      },
    ]);
    expect(database.prepare("select * from monthly_cost_close_events").get()).toMatchObject({
      close_id: "legacy-close-locked-1",
      event_type: "migration",
      actor_member_id: "admin-1",
      previous_status: "open",
      next_status: "in_review",
    });
  });

  test("leaves the legacy table intact for rollback compatibility", () => {
    const database = createLegacyDatabase();
    database.prepare(`
      insert into period_locks (id, month, is_locked, created_at, updated_at)
      values ('legacy-1', '2026-05', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    applyMonthlyCloseMigration(database);

    expect(database.prepare("select month, is_locked from period_locks").get()).toEqual({
      month: "2026-05",
      is_locked: 0,
    });
    expect(database.prepare("select count(*) as count from monthly_cost_closes").get()).toEqual({ count: 0 });
  });
});
