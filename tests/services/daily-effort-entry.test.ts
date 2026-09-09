// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import { createDailyAllocationPlan } from "../support/daily-effort-fixtures";
import {
  createDailyWorkLog,
  deleteDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
} from "../../app/db/repositories/daily-work-logs";
import {
  createEffortAllocation,
  deleteEffortAllocation,
  listAllocationsByWorkLog,
} from "../../app/db/repositories/effort-allocations";
import { createMember } from "../../app/db/repositories/members";
import { findMonthlyEffortSubmission } from "../../app/db/repositories/monthly-effort-submissions";
import { createProjectAssignment } from "../../app/db/repositories/project-assignments";
import {
  archiveProject,
  createProject,
} from "../../app/db/repositories/projects";
import { createTask } from "../../app/db/repositories/tasks";
import {
  DailyEffortEntryError,
  getDailyEffortStartingPoint,
  saveDailyEffortEntry,
} from "../../app/services/daily-effort-entry";
import { startMonthlyCostReview } from "../../app/services/monthly-cost-close";
import { submitMonthlyEffort } from "../../app/services/monthly-effort-submission";
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
    hourlyCostRate: 1000,
  });
  const first = createProject(db, {
    code: "P-1",
    name: "First",
    projectType: "billable",
  });
  const second = createProject(db, {
    code: "P-2",
    name: "Second",
    projectType: "internal",
  });
  createProjectAssignment(db, { memberId: member.id, projectId: first.id });
  createProjectAssignment(db, { memberId: member.id, projectId: second.id });
  const firstTask = createTask(db, { projectId: first.id, name: "First task" });
  const secondTask = createTask(db, {
    projectId: second.id,
    name: "Second task",
  });
  return { member, first, second, firstTask, secondTask };
}

describe("daily effort entry", () => {
  test("invalidates a submitted month only after a successful unified save", () => {
    const { member, first } = setup();
    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 8,
      rows: [{ projectId: first.id, allocatedHours: 8 }],
    });
    submitMonthlyEffort(db, {
      memberId: member.id,
      month: "2026-07",
      actorMemberId: member.id,
    });

    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 8,
        rows: [{ projectId: "missing", allocatedHours: 8 }],
      }),
    ).toThrow();
    expect(findMonthlyEffortSubmission(db, member.id, "2026-07")?.status).toBe(
      "submitted",
    );

    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 7.5,
      rows: [{ projectId: first.id, allocatedHours: 7.5 }],
    });
    expect(findMonthlyEffortSubmission(db, member.id, "2026-07")).toMatchObject(
      {
        status: "draft",
        invalidatedByMemberId: member.id,
      },
    );
  });

  test("atomically saves several rows and removes omitted persisted rows", () => {
    const { member, first, second } = setup();
    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 8,
      rows: [
        { projectId: first.id, allocatedHours: 6 },
        { projectId: second.id, allocatedHours: 2 },
      ],
    });
    const log = findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-01")!;
    const before = listAllocationsByWorkLog(db, log.id);
    expect(before).toHaveLength(2);

    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 9.5,
      rows: [
        {
          allocationId: before[0].id,
          projectId: first.id,
          allocatedHours: 9.5,
          note: "overtime",
        },
      ],
    });
    expect(
      findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-01")
        ?.totalWorkingHours,
    ).toBe(9.5);
    expect(listAllocationsByWorkLog(db, log.id)).toMatchObject([
      { projectId: first.id, allocatedHours: 9.5, note: "overtime" },
    ]);
  });

  test("rejects the whole submission when a later row has another project's task", () => {
    const { member, first, secondTask } = setup();
    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 8,
        rows: [
          { projectId: first.id, allocatedHours: 4 },
          { projectId: first.id, taskId: secondTask.id, allocatedHours: 4 },
        ],
      }),
    ).toThrow(DailyEffortEntryError);
    expect(
      findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-01"),
    ).toBeUndefined();
  });

  test("rejects allocation IDs outside the member and unassigned projects", () => {
    const { member, first } = setup();
    const otherMember = createMember(db, {
      displayName: "Jiro",
      email: "jiro@example.com",
      passwordHash: "hash",
    });
    createProjectAssignment(db, {
      memberId: otherMember.id,
      projectId: first.id,
    });
    saveDailyEffortEntry(db, {
      memberId: otherMember.id,
      workDate: "2026-07-01",
      totalWorkingHours: 8,
      rows: [{ projectId: first.id, allocatedHours: 8 }],
    });
    const otherLog = findDailyWorkLogByMemberAndDate(
      db,
      otherMember.id,
      "2026-07-01",
    )!;
    const otherAllocation = listAllocationsByWorkLog(db, otherLog.id)[0];

    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 8,
        rows: [
          {
            allocationId: otherAllocation.id,
            projectId: first.id,
            allocatedHours: 8,
          },
        ],
      }),
    ).toThrow("対象の実績工数が見つかりません");

    const unassigned = createProject(db, {
      code: "P-3",
      name: "Unassigned",
      projectType: "internal",
    });
    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 8,
        rows: [{ projectId: unassigned.id, allocatedHours: 8 }],
      }),
    ).toThrow("アサインされていない案件");
  });

  test("creates unsaved plan and nearest-workday starting points", () => {
    const { member, first, second } = setup();
    createDailyAllocationPlan(db, member.id, first.id, "2026-07-03", 5);
    const plan = getDailyEffortStartingPoint(db, {
      memberId: member.id,
      workDate: "2026-07-03",
      source: "daily-plan",
    });
    expect(plan).toMatchObject({
      totalWorkingHours: 5,
      rows: [{ projectId: first.id, allocatedHours: 5 }],
    });
    expect(
      findDailyWorkLogByMemberAndDate(db, member.id, "2026-07-03"),
    ).toBeUndefined();

    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-01",
      totalWorkingHours: 6,
      rows: [{ projectId: first.id, allocatedHours: 6 }],
    });
    createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-02",
      totalWorkingHours: 4,
    });
    const recent = getDailyEffortStartingPoint(db, {
      memberId: member.id,
      workDate: "2026-07-03",
      source: "recent-workday",
    });
    expect(recent).toMatchObject({
      sourceDate: "2026-07-01",
      totalWorkingHours: 6,
    });

    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-04",
      totalWorkingHours: 3,
      rows: [{ projectId: second.id, allocatedHours: 3 }],
    });
    archiveProject(db, second.id, new Date().toISOString());
    const skippedIneligible = getDailyEffortStartingPoint(db, {
      memberId: member.id,
      workDate: "2026-07-05",
      source: "recent-workday",
    });
    expect(skippedIneligible.sourceDate).toBe("2026-07-01");

    expect(() =>
      getDailyEffortStartingPoint(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        source: "recent-workday",
      }),
    ).toThrow("既に実績工数があるため");
  });

  test("rejects writes to a protected month", () => {
    const { member, first } = setup();
    startMonthlyCostReview(db, { month: "2026-07", actorMemberId: member.id });
    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 8,
        rows: [{ projectId: first.id, allocatedHours: 8 }],
      }),
    ).toThrow();
  });

  test("rejects impossible dates and values beyond a day", () => {
    const { member, first, second } = setup();

    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-02-29",
        totalWorkingHours: 8,
        rows: [{ projectId: first.id, allocatedHours: 8 }],
      }),
    ).toThrow("日付が不正");
    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 24.25,
        rows: [{ projectId: first.id, allocatedHours: 8 }],
      }),
    ).toThrow("24h 以下");
    expect(() =>
      saveDailyEffortEntry(db, {
        memberId: member.id,
        workDate: "2026-07-01",
        totalWorkingHours: 24,
        rows: [
          { projectId: first.id, allocatedHours: 16 },
          { projectId: second.id, allocatedHours: 8.25 },
        ],
      }),
    ).toThrow("合計は 24h 以下");
  });

  test("re-enters a cleared day without restoring deleted allocations", () => {
    const { member, first } = setup();
    const original = createDailyWorkLog(db, {
      memberId: member.id,
      workDate: "2026-07-06",
      totalWorkingHours: 8,
    });
    const allocation = createEffortAllocation(db, {
      dailyWorkLogId: original.id,
      memberId: member.id,
      projectId: first.id,
      allocatedHours: 8,
    });
    deleteEffortAllocation(db, allocation.id, "2026-07-07T00:00:00.000Z");
    deleteDailyWorkLog(db, original.id, "2026-07-07T00:00:00.000Z");

    saveDailyEffortEntry(db, {
      memberId: member.id,
      workDate: "2026-07-06",
      totalWorkingHours: 6,
      rows: [],
    });

    const restored = findDailyWorkLogByMemberAndDate(
      db,
      member.id,
      "2026-07-06",
    )!;
    expect(restored.id).toBe(original.id);
    expect(restored.totalWorkingHours).toBe(6);
    expect(listAllocationsByWorkLog(db, restored.id)).toEqual([]);
  });
});
