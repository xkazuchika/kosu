// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  createDatabaseConnection,
  type KosuDatabase,
} from "../../app/db/client";
import { getMonthlyPeriodState } from "../../app/services/monthly-cost-close";
import { createTestDatabase } from "./helpers";

test("migration preserves legacy cost states, snapshots and history with foreign keys enabled", () => {
  const connection = createDatabaseConnection(":memory:");
  const { sqlite, db } = connection;
  try {
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };
    for (const entry of journal.entries.filter(
      (e) => Number(e.tag.slice(0, 4)) < 9,
    )) {
      sqlite.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
    }
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      INSERT INTO members (id, display_name, email, password_hash, role) VALUES ('admin', 'Admin', 'admin@test', 'hash', 'admin');
      INSERT INTO projects (id, code, name, project_type) VALUES ('project', 'INT', 'Internal', 'internal');
      INSERT INTO monthly_cost_closes (id, month, status, entered_review_by_member_id, entered_review_at, approved_by_member_id, approved_at) VALUES
        ('open', '2026-05', 'open', NULL, NULL, NULL, NULL),
        ('review', '2026-06', 'in_review', 'admin', '2026-07-01', NULL, NULL),
        ('approved', '2026-07', 'approved', 'admin', '2026-08-01', 'admin', '2026-08-02');
      INSERT INTO monthly_cost_close_events (id, close_id, event_type, actor_member_id, previous_status, next_status, occurred_at)
        VALUES ('event', 'approved', 'approved', 'admin', 'in_review', 'approved', '2026-08-02');
      INSERT INTO monthly_cost_close_project_snapshots
        (id, close_id, project_id, project_code, project_name, project_type, project_is_archived, monthly_planned_cost, monthly_actual_cost, cumulative_actual_cost)
        VALUES ('snapshot', 'approved', 'project', 'INT', 'Internal', 'internal', 0, 12345, 56789, 99999);
    `);
    const beforeCloses = sqlite
      .prepare("SELECT * FROM monthly_cost_closes ORDER BY month")
      .all();
    const beforeEvent = sqlite
      .prepare("SELECT * FROM monthly_cost_close_events WHERE id = 'event'")
      .get();
    const beforeSnapshots = sqlite
      .prepare("SELECT * FROM monthly_cost_close_project_snapshots")
      .all();
    // Production migration runs transactionally; additive ALTERs must not cascade-delete children.
    sqlite.transaction(() =>
      sqlite.exec(readFileSync("drizzle/0009_sleepy_sabra.sql", "utf8")),
    )();
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(
      sqlite.prepare("SELECT * FROM monthly_cost_closes ORDER BY month").all(),
    ).toMatchObject(beforeCloses);
    expect(
      sqlite
        .prepare("SELECT * FROM monthly_cost_close_events WHERE id = 'event'")
        .get(),
    ).toMatchObject(beforeEvent!);
    expect(
      sqlite
        .prepare("SELECT * FROM monthly_cost_close_project_snapshots")
        .all(),
    ).toEqual(beforeSnapshots);
    const states = ["2026-05", "2026-06", "2026-07"].map((month) =>
      getMonthlyPeriodState(db as KosuDatabase, month),
    );
    expect(states).toMatchObject([
      {
        effortStatus: "open",
        costStatus: "open",
        isProtected: false,
        close: { effortReviewedAt: null, effortConfirmedAt: null },
      },
      {
        effortStatus: "in_review",
        costStatus: "in_review",
        isProtected: true,
        close: {
          effortReviewedByMemberId: "admin",
          effortReviewedAt: "2026-07-01",
          effortConfirmedAt: null,
        },
      },
      {
        effortStatus: "confirmed",
        costStatus: "approved",
        isProtected: true,
        close: {
          effortConfirmedByMemberId: "admin",
          effortConfirmedAt: "2026-08-02",
        },
      },
    ]);
    expect(
      sqlite
        .prepare(
          "SELECT actor_member_id, next_effort_status FROM monthly_cost_close_events WHERE event_type = 'effort_migration' ORDER BY close_id",
        )
        .all(),
    ).toEqual([
      { actor_member_id: null, next_effort_status: "confirmed" },
      { actor_member_id: null, next_effort_status: "open" },
      { actor_member_id: null, next_effort_status: "in_review" },
    ]);
  } finally {
    sqlite.close();
  }
});

test("fresh database defaults effort to open and rejects invalid effort states", () => {
  const { sqlite } = createTestDatabase();
  try {
    sqlite
      .prepare(
        "INSERT INTO monthly_cost_closes (id, month) VALUES ('new', '2026-07')",
      )
      .run();
    expect(
      sqlite.prepare("SELECT effort_status FROM monthly_cost_closes").get(),
    ).toEqual({ effort_status: "open" });
    for (const value of ["approved", "", "invalid", null]) {
      expect(() =>
        sqlite
          .prepare("UPDATE monthly_cost_closes SET effort_status = ?")
          .run(value),
      ).toThrow();
    }
  } finally {
    sqlite.close();
  }
});
