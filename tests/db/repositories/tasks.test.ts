// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import { createProject } from "../../../app/db/repositories/projects";
import {
  archiveTask,
  createTask,
  findTaskById,
  listActiveTasksByProject,
  listTasksByProject,
} from "../../../app/db/repositories/tasks";
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

describe("tasks repository", () => {
  test("create and find task", () => {
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const task = createTask(db, { projectId: project.id, name: "Design" });

    expect(findTaskById(db, task.id)?.name).toBe("Design");
    expect(listTasksByProject(db, project.id)).toHaveLength(1);
  });

  test("archive excludes from active list", () => {
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });
    const task = createTask(db, { projectId: project.id, name: "Design" });

    archiveTask(db, task.id, "2026-07-01T00:00:00Z");

    expect(listActiveTasksByProject(db, project.id)).toHaveLength(0);
  });
});
