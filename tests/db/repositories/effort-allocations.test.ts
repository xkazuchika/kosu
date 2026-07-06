// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import { createDailyWorkLog } from "../../../app/db/repositories/daily-work-logs";
import { createEffortAllocation, listAllocationsByWorkLog } from "../../../app/db/repositories/effort-allocations";
import { createMember } from "../../../app/db/repositories/members";
import { createProject } from "../../../app/db/repositories/projects";
import { createTask } from "../../../app/db/repositories/tasks";
import { createTestDatabase } from "../../db/helpers";

let db: KosuDatabase;
let connection: DatabaseConnection;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => {
  connection.sqlite.close();
});

describe("effort allocations repository", () => {
  test("create allocation with cost rate snapshot", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
      hourlyCostRate: 5000,
    });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const log = createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-05", totalWorkingHours: 8 });

    const allocation = createEffortAllocation(db, {
      dailyWorkLogId: log.id,
      memberId: member.id,
      projectId: project.id,
      allocatedHours: 8,
      hourlyCostRateSnapshot: 5000,
    });

    expect(allocation.hourlyCostRateSnapshot).toBe(5000);
    expect(listAllocationsByWorkLog(db, log.id)).toHaveLength(1);
  });

  test("create allocation with optional task", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const task = createTask(db, { projectId: project.id, name: "Design" });
    const log = createDailyWorkLog(db, { memberId: member.id, workDate: "2026-07-05", totalWorkingHours: 8 });

    createEffortAllocation(db, {
      dailyWorkLogId: log.id,
      memberId: member.id,
      projectId: project.id,
      taskId: task.id,
      allocatedHours: 4,
    });

    expect(listAllocationsByWorkLog(db, log.id)[0]?.taskId).toBe(task.id);
  });
});
