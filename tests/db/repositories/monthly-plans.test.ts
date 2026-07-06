// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import { createMember } from "../../../app/db/repositories/members";
import { createProject } from "../../../app/db/repositories/projects";
import {
  createMonthlyPlan,
  findMonthlyPlan,
  listMonthlyPlansByMember,
  updateMonthlyPlan,
} from "../../../app/db/repositories/monthly-plans";
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

describe("monthly plans repository", () => {
  test("create plan captures cost rate snapshot", () => {
    const member = createMember(db, {
      displayName: "Taro",
      email: "taro@example.com",
      passwordHash: "hash",
      hourlyCostRate: 5000,
    });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    const plan = createMonthlyPlan(db, {
      memberId: member.id,
      projectId: project.id,
      month: "2026-07",
      plannedHours: 80,
      hourlyCostRateSnapshot: 5000,
    });

    expect(plan.hourlyCostRateSnapshot).toBe(5000);
    expect(listMonthlyPlansByMember(db, member.id)).toHaveLength(1);
  });

  test("find plan by composite key", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    createMonthlyPlan(db, { memberId: member.id, projectId: project.id, month: "2026-07", plannedHours: 80 });

    const found = findMonthlyPlan(db, member.id, project.id, "2026-07");
    expect(found?.plannedHours).toBe(80);
  });

  test("update plan", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    const plan = createMonthlyPlan(db, { memberId: member.id, projectId: project.id, month: "2026-07", plannedHours: 80 });
    const updated = updateMonthlyPlan(db, plan.id, { plannedHours: 100 });

    expect(updated.plannedHours).toBe(100);
  });
});
