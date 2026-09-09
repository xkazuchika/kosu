// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createPreIntegrityDatabase() {
  const database = new Database(":memory:");
  databases.push(database);
  for (const name of [
    "0000_init.sql",
    "0001_handy_famine.sql",
    "0002_long_agent_zero.sql",
    "0003_nostalgic_scourge.sql",
    "0004_modern_stephen_strange.sql",
  ]) {
    database.exec(
      readFileSync(path.join(process.cwd(), "drizzle", name), "utf8"),
    );
  }
  return database;
}

function applyAssignmentIntegrityMigration(database: Database.Database) {
  database.exec(
    readFileSync(
      path.join(process.cwd(), "drizzle", "0005_tough_lila_cheney.sql"),
      "utf8",
    ).replaceAll("--> statement-breakpoint", ""),
  );
}

describe("active project assignment migration", () => {
  test("keeps the newest deterministic active row and preserves duplicate history", () => {
    const database = createPreIntegrityDatabase();
    database.exec(`
      INSERT INTO members (id, display_name, email, password_hash, role, is_active)
      VALUES ('member-1', 'Member', 'member@example.com', 'hash', 'member', 1);
      INSERT INTO projects (id, code, name, project_type, is_archived)
      VALUES ('project-1', 'P-1', 'Project', 'internal', 0);
      INSERT INTO project_assignments
        (id, member_id, project_id, assignment_role, assigned_at)
      VALUES
        ('assignment-a', 'member-1', 'project-1', 'Old', '2026-07-01T00:00:00.000Z'),
        ('assignment-b', 'member-1', 'project-1', 'New', '2026-07-02T00:00:00.000Z'),
        ('assignment-c', 'member-1', 'project-1', 'Newest tie', '2026-07-02T00:00:00.000Z');
    `);

    applyAssignmentIntegrityMigration(database);

    const rows = database
      .prepare("SELECT id, removed_at FROM project_assignments ORDER BY id")
      .all();
    expect(rows).toEqual([
      { id: "assignment-a", removed_at: "2026-07-02T00:00:00.000Z" },
      { id: "assignment-b", removed_at: "2026-07-02T00:00:00.000Z" },
      { id: "assignment-c", removed_at: null },
    ]);
    expect(() =>
      database
        .prepare(
          `INSERT INTO project_assignments
             (id, member_id, project_id, assigned_at)
           VALUES ('assignment-d', 'member-1', 'project-1', CURRENT_TIMESTAMP)`,
        )
        .run(),
    ).toThrow();
  });
});
