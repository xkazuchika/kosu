import type { KosuDatabase } from "~/db/client";
import { findMemberById } from "~/db/repositories/members";
import {
  createProjectAssignment,
  findActiveAssignment,
  updateProjectAssignment,
  type AssignmentSource,
} from "~/db/repositories/project-assignments";
import { findProjectById } from "~/db/repositories/projects";

export class ProjectAssignmentError extends Error {}

export function validateNewProjectAssignment(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
) {
  validateAssignmentTarget(db, memberId, projectId);
  if (findActiveAssignment(db, memberId, projectId)) {
    throw new ProjectAssignmentError(
      "このメンバーは既に案件へアサインされています。",
    );
  }
}

export function createValidatedProjectAssignment(
  db: KosuDatabase,
  input: {
    memberId: string;
    projectId: string;
    assignmentRole?: string | null;
    assignmentSource?: AssignmentSource;
  },
) {
  validateNewProjectAssignment(db, input.memberId, input.projectId);
  return createProjectAssignment(db, input);
}

export function updateActiveProjectAssignmentRole(
  db: KosuDatabase,
  input: {
    memberId: string;
    projectId: string;
    assignmentRole?: string | null;
  },
) {
  validateAssignmentTarget(db, input.memberId, input.projectId);
  const assignment = findActiveAssignment(db, input.memberId, input.projectId);
  if (!assignment) {
    throw new ProjectAssignmentError("有効なアサインが見つかりません。");
  }

  return updateProjectAssignment(db, assignment.id, {
    assignmentRole: input.assignmentRole ?? null,
  });
}

function validateAssignmentTarget(
  db: KosuDatabase,
  memberId: string,
  projectId: string,
) {
  const member = findMemberById(db, memberId);
  if (!member) {
    throw new ProjectAssignmentError("メンバーが存在しません。");
  }
  if (!member.isActive) {
    throw new ProjectAssignmentError("無効なメンバーはアサインできません。");
  }

  const project = findProjectById(db, projectId);
  if (!project) {
    throw new ProjectAssignmentError("案件が存在しません。");
  }
  if (project.isArchived) {
    throw new ProjectAssignmentError(
      "アーカイブ済みの案件にはアサインできません。",
    );
  }
}
