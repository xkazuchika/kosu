// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../../app/db/client";
import {
  aggregateDailyAllocationPlanTotalsByDate,
  aggregateDailyAllocationPlanTotalsByProject,
  deleteDailyAllocationPlan,
  deleteDailyAllocationPlanByMemberDateProject,
  findDailyAllocationPlan,
  listDailyAllocationPlansByMemberAndDate,
  listDailyAllocationPlansByMemberAndMonth,
  upsertDailyAllocationPlan,
} from "../../../app/db/repositories/daily-allocation-plans";
import { createMember } from "../../../app/db/repositories/members";
import { createProject } from "../../../app/db/repositories/projects";
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

describe("daily allocation plans repository", () => {
  test("creates and finds daily allocation plan", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    const plan = upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });

    expect(plan.plannedHours).toBe(4);
    expect(findDailyAllocationPlan(db, member.id, "2026-07-01", project.id)?.id).toBe(plan.id);
  });

  test("upsert updates existing member date project row", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    const first = upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    const updated = upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: project.id,
      planDate: "2026-07-01",
      plannedHours: 6,
    });

    expect(updated.id).toBe(first.id);
    expect(updated.plannedHours).toBe(6);
    expect(listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01")).toHaveLength(1);
  });

  test("deletes by id and composite key", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const projectA = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const projectB = createProject(db, { code: "PRJ-002", name: "App", projectType: "internal" });

    const planA = upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: projectA.id,
      planDate: "2026-07-01",
      plannedHours: 4,
    });
    upsertDailyAllocationPlan(db, {
      memberId: member.id,
      projectId: projectB.id,
      planDate: "2026-07-01",
      plannedHours: 2,
    });

    deleteDailyAllocationPlan(db, planA.id);
    expect(findDailyAllocationPlan(db, member.id, "2026-07-01", projectA.id)).toBeUndefined();

    deleteDailyAllocationPlanByMemberDateProject(db, member.id, "2026-07-01", projectB.id);
    expect(listDailyAllocationPlansByMemberAndDate(db, member.id, "2026-07-01")).toHaveLength(0);
  });

  test("lists by month and aggregates by date and project", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const projectA = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const projectB = createProject(db, { code: "PRJ-002", name: "App", projectType: "internal" });

    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: projectA.id, planDate: "2026-07-01", plannedHours: 4 });
    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: projectB.id, planDate: "2026-07-01", plannedHours: 2 });
    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: projectA.id, planDate: "2026-07-02", plannedHours: 3 });
    upsertDailyAllocationPlan(db, { memberId: member.id, projectId: projectA.id, planDate: "2026-08-01", plannedHours: 8 });

    expect(listDailyAllocationPlansByMemberAndMonth(db, member.id, "2026-07")).toHaveLength(3);
    expect(aggregateDailyAllocationPlanTotalsByDate(db, member.id, "2026-07")).toEqual([
      { planDate: "2026-07-01", totalPlannedHours: 6 },
      { planDate: "2026-07-02", totalPlannedHours: 3 },
    ]);
    expect(aggregateDailyAllocationPlanTotalsByProject(db, member.id, "2026-07")).toEqual([
      { projectId: projectA.id, totalPlannedHours: 7 },
      { projectId: projectB.id, totalPlannedHours: 2 },
    ]);
  });
});
