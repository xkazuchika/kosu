// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import {
  archiveProject,
  createProject,
  findActiveProjectByCode,
  findProjectByCode,
  listActiveProjects,
  listProjects,
  updateProject,
} from "../../../app/db/repositories/projects";
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

describe("projects repository", () => {
  test("create and find project", () => {
    const project = createProject(db, {
      code: "PRJ-001",
      name: "Website",
      projectType: "billable",
      clientName: "Acme",
      revenueOrBudgetAmount: 1_000_000,
      contractRevenueAmount: 1_200_000,
      laborCostBudgetAmount: 600_000,
    });

    expect(project.code).toBe("PRJ-001");

    const found = findProjectByCode(db, "PRJ-001");
    expect(found?.name).toBe("Website");
    expect(found?.revenueOrBudgetAmount).toBe(1_000_000);
    expect(found?.contractRevenueAmount).toBe(1_200_000);
    expect(found?.laborCostBudgetAmount).toBe(600_000);
  });

  test("list projects ordered by code", () => {
    createProject(db, { code: "B", name: "B", projectType: "internal" });
    createProject(db, { code: "A", name: "A", projectType: "internal" });

    expect(listProjects(db).map((p) => p.code)).toEqual(["A", "B"]);
  });

  test("archive excludes from active list", () => {
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    archiveProject(db, project.id, "2026-07-01T00:00:00Z");

    expect(listActiveProjects(db)).toHaveLength(0);
    expect(findActiveProjectByCode(db, "PRJ-001")).toBeUndefined();
  });

  test("update project", () => {
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const updated = updateProject(db, project.id, {
      name: "Website Renewed",
      contractRevenueAmount: 500_000,
      laborCostBudgetAmount: 250_000,
    });
    expect(updated.name).toBe("Website Renewed");
    expect(updated.contractRevenueAmount).toBe(500_000);
    expect(updated.laborCostBudgetAmount).toBe(250_000);
  });

  test("duplicate code throws", () => {
    createProject(db, { code: "PRJ-001", name: "A", projectType: "internal" });
    expect(() => createProject(db, { code: "PRJ-001", name: "B", projectType: "internal" })).toThrow();
  });
});
