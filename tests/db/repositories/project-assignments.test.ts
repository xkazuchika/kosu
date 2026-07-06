// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";

import type { KosuDatabase } from "../../../app/db/client";
import type { DatabaseConnection } from "../../../app/db/client";
import { createMember } from "../../../app/db/repositories/members";
import { createProject } from "../../../app/db/repositories/projects";
import {
  createProjectAssignment,
  findActiveAssignment,
  listActiveAssignmentsByMember,
  listSelfAssignedProjectIds,
  removeProjectAssignment,
} from "../../../app/db/repositories/project-assignments";
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

describe("project assignments repository", () => {
  test("create and find active assignment", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    createProjectAssignment(db, {
      memberId: member.id,
      projectId: project.id,
      assignmentRole: "Engineer",
    });

    const found = findActiveAssignment(db, member.id, project.id);
    expect(found?.assignmentRole).toBe("Engineer");
    expect(listActiveAssignmentsByMember(db, member.id)).toHaveLength(1);
  });

  test("self-assigned source is tracked", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    createProjectAssignment(db, {
      memberId: member.id,
      projectId: project.id,
      assignmentSource: "self_assigned",
    });

    expect(listSelfAssignedProjectIds(db)).toEqual([{ memberId: member.id, projectId: project.id }]);
  });

  test("remove assignment preserves historical record", () => {
    const member = createMember(db, { displayName: "Taro", email: "taro@example.com", passwordHash: "hash" });
    const project = createProject(db, { code: "PRJ-001", name: "Website", projectType: "billable" });

    const assignment = createProjectAssignment(db, { memberId: member.id, projectId: project.id });
    removeProjectAssignment(db, assignment.id, "2026-07-01T00:00:00Z");

    expect(findActiveAssignment(db, member.id, project.id)).toBeUndefined();
  });
});
