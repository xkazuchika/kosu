// @vitest-environment node

import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { createWorkspace } from "../../app/db/repositories/workspace";
import { workspaceSettings } from "../../app/db/schema";
import { getWorkspaceCalendarContext } from "../../app/services/workspace-calendar";

let dataDir: string;

beforeEach(() => {
  dataDir = path.join(os.tmpdir(), `kosu-workspace-calendar-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dataDir, { recursive: true });
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

test("resolves workspace-local today and current month at a UTC boundary", () => {
  const connection = createDatabaseConnection(path.join(dataDir, "kosu.sqlite"));
  runMigrations(connection);
  createWorkspace(connection.db, { displayName: "Acme", defaultTimezone: "Asia/Tokyo" });

  const calendar = getWorkspaceCalendarContext(connection.db, new Date("2026-07-31T15:30:00.000Z"));

  expect(calendar).toMatchObject({
    timeZone: "Asia/Tokyo",
    today: "2026-08-01",
    currentMonth: "2026-08",
    timezoneWarning: null,
  });
  connection.sqlite.close();
});

test("falls back to UTC and warns for a legacy invalid timezone", () => {
  const connection = createDatabaseConnection(path.join(dataDir, "kosu.sqlite"));
  runMigrations(connection);
  connection.db
    .insert(workspaceSettings)
    .values({ id: "legacy", displayName: "Legacy", defaultTimezone: "Not/A_Timezone" })
    .run();

  const calendar = getWorkspaceCalendarContext(connection.db, new Date("2026-07-31T15:30:00.000Z"));

  expect(calendar.timeZone).toBe("UTC");
  expect(calendar.today).toBe("2026-07-31");
  expect(calendar.currentMonth).toBe("2026-07");
  expect(calendar.timezoneWarning).toContain("UTC");
  connection.sqlite.close();
});
