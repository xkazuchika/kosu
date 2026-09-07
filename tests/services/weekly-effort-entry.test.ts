// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { findDailyWorkLogByMemberAndDate } from "../../app/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import {
  archiveProject,
  createProject,
} from "../../app/db/repositories/projects";
import { listWeekDates } from "../../app/lib/time";
import { startMonthlyCostReview } from "../../app/services/monthly-cost-close";
import {
  getWeeklyEffortDraft,
  saveWeeklyEffortDraft,
  type WeeklyEffortDraft,
} from "../../app/services/weekly-effort-entry";
import { createTestDatabase } from "../db/helpers";

let connection: DatabaseConnection;
let db: KosuDatabase;
beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});
afterEach(() => connection.sqlite.close());

function setup() {
  const member = createMember(db, {
    displayName: "Taro",
    email: "taro@example.com",
    passwordHash: "hash",
  });
  const project = createProject(db, {
    code: "P-1",
    name: "Project",
    projectType: "internal",
  });
  createProjectAssignment(db, { memberId: member.id, projectId: project.id });
  return { member, project };
}

function draft(memberProjectId: string): WeeklyEffortDraft {
  const dates = listWeekDates("2026-07-08");
  return {
    weekDate: dates[0],
    dates,
    totalWorkingHours: { [dates[0]]: "8", [dates[1]]: "9.5" },
    rows: [
      {
        key: "row",
        projectId: memberProjectId,
        taskId: "",
        note: "",
        allocationIds: {},
        hours: { [dates[0]]: "8", [dates[1]]: "9.5" },
      },
    ],
  };
}

describe("weekly effort entry", () => {
  test("saves multiple days atomically and reads them back as a reusable row", () => {
    const { member, project } = setup();
    expect(
      saveWeeklyEffortDraft(db, member.id, draft(project.id)),
    ).toMatchObject({ changedDates: 2 });
    const monday = findDailyWorkLogByMemberAndDate(
      db,
      member.id,
      "2026-07-06",
    )!;
    expect(listAllocationsByWorkLog(db, monday.id)[0].allocatedHours).toBe(8);
    const loaded = getWeeklyEffortDraft(db, member.id, "2026-07-08");
    expect(loaded.rows).toHaveLength(1);
    expect(loaded.rows[0].hours).toMatchObject({
      "2026-07-06": "8",
      "2026-07-07": "9.5",
    });
  });

  test("rolls back all days when one day is invalid", () => {
    const { member, project } = setup();
    const input = draft(project.id);
    input.rows[0].hours[input.dates[1]] = "1.1";
    expect(() => saveWeeklyEffortDraft(db, member.id, input)).toThrow(
      /2026-07-07/,
    );
    expect(
      findDailyWorkLogByMemberAndDate(db, member.id, input.dates[0]),
    ).toBeUndefined();
  });

  test("preserves persisted IDs when editing archived historical rows", () => {
    const { member, project } = setup();
    saveWeeklyEffortDraft(db, member.id, draft(project.id));
    archiveProject(db, project.id, new Date().toISOString());

    const loaded = getWeeklyEffortDraft(db, member.id, "2026-07-08");
    const mondayId = loaded.rows[0].allocationIds[loaded.dates[0]];
    loaded.rows[0].hours[loaded.dates[0]] = "7.5";
    saveWeeklyEffortDraft(db, member.id, loaded);

    const reloaded = getWeeklyEffortDraft(db, member.id, "2026-07-08");
    expect(reloaded.rows[0].allocationIds[reloaded.dates[0]]).toBe(mondayId);
    expect(reloaded.rows[0].hours[reloaded.dates[0]]).toBe("7.5");
  });

  test("rejects a cross-month week when an affected month is protected", () => {
    const { member, project } = setup();
    startMonthlyCostReview(db, { month: "2026-09", actorMemberId: member.id });
    const dates = listWeekDates("2026-08-31");
    const input: WeeklyEffortDraft = {
      weekDate: dates[0],
      dates,
      totalWorkingHours: { [dates[0]]: "8", [dates[1]]: "8" },
      rows: [
        {
          key: "row",
          projectId: project.id,
          taskId: "",
          note: "",
          allocationIds: {},
          hours: { [dates[0]]: "8", [dates[1]]: "8" },
        },
      ],
    };
    expect(() => saveWeeklyEffortDraft(db, member.id, input)).toThrow();
    expect(
      findDailyWorkLogByMemberAndDate(db, member.id, dates[0]),
    ).toBeUndefined();
  });
});
