// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { DatabaseConnection, KosuDatabase } from "../../app/db/client";
import {
  createMember,
  deactivateMember,
} from "../../app/db/repositories/members";
import {
  listAssignmentsByProject,
  removeProjectAssignment,
} from "../../app/db/repositories/project-assignments";
import {
  archiveProject,
  createProject,
} from "../../app/db/repositories/projects";
import {
  createValidatedProjectAssignment,
  updateActiveProjectAssignmentRole,
} from "../../app/services/project-assignment";
import { createTestDatabase } from "../db/helpers";

let connection: DatabaseConnection;
let db: KosuDatabase;

beforeEach(() => {
  connection = createTestDatabase();
  db = connection.db;
});

afterEach(() => connection.sqlite.close());

describe("project assignment integrity", () => {
  test("rejects inactive members, archived projects, and active duplicates", () => {
    const member = createMember(db, {
      displayName: "Member",
      email: "member@example.com",
      passwordHash: "hash",
    });
    const project = createProject(db, {
      code: "P-1",
      name: "Project",
      projectType: "internal",
    });
    deactivateMember(db, member.id);
    expect(() =>
      createValidatedProjectAssignment(db, {
        memberId: member.id,
        projectId: project.id,
      }),
    ).toThrow("無効なメンバー");

    const activeMember = createMember(db, {
      displayName: "Active",
      email: "active@example.com",
      passwordHash: "hash",
    });
    archiveProject(db, project.id, "2026-07-01T00:00:00.000Z");
    expect(() =>
      createValidatedProjectAssignment(db, {
        memberId: activeMember.id,
        projectId: project.id,
      }),
    ).toThrow("アーカイブ済み");

    const activeProject = createProject(db, {
      code: "P-2",
      name: "Active project",
      projectType: "internal",
    });
    createValidatedProjectAssignment(db, {
      memberId: activeMember.id,
      projectId: activeProject.id,
    });
    expect(() =>
      createValidatedProjectAssignment(db, {
        memberId: activeMember.id,
        projectId: activeProject.id,
      }),
    ).toThrow("既に");
  });

  test("updates the active role and allows reassignment after removal", () => {
    const member = createMember(db, {
      displayName: "Member",
      email: "member@example.com",
      passwordHash: "hash",
    });
    const project = createProject(db, {
      code: "P-1",
      name: "Project",
      projectType: "internal",
    });
    const first = createValidatedProjectAssignment(db, {
      memberId: member.id,
      projectId: project.id,
      assignmentRole: "Engineer",
    });
    const updated = updateActiveProjectAssignmentRole(db, {
      memberId: member.id,
      projectId: project.id,
      assignmentRole: "Lead",
    });
    expect(updated).toMatchObject({ id: first.id, assignmentRole: "Lead" });

    removeProjectAssignment(db, first.id, "2026-07-01T00:00:00.000Z");
    const second = createValidatedProjectAssignment(db, {
      memberId: member.id,
      projectId: project.id,
      assignmentRole: "Advisor",
    });
    expect(second.id).not.toBe(first.id);
    expect(listAssignmentsByProject(db, project.id)).toHaveLength(2);
  });
});
