import { and, asc, eq, isNull } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { projectAssignments } from "../schema";

export type AssignmentSource = "admin" | "self_assigned";

export type ProjectAssignmentInsert = {
  memberId: string;
  projectId: string;
  assignmentRole?: string | null;
  assignmentSource?: AssignmentSource;
};

export type ProjectAssignmentUpdate = Partial<ProjectAssignmentInsert>;

export function listAssignmentsByMember(db: KosuDatabase, memberId: string) {
  return db
    .select()
    .from(projectAssignments)
    .where(eq(projectAssignments.memberId, memberId))
    .orderBy(asc(projectAssignments.assignedAt))
    .all();
}

export function listAssignmentsByProject(db: KosuDatabase, projectId: string) {
  return db
    .select()
    .from(projectAssignments)
    .where(eq(projectAssignments.projectId, projectId))
    .orderBy(asc(projectAssignments.assignedAt))
    .all();
}

export function findActiveAssignment(db: KosuDatabase, memberId: string, projectId: string) {
  return db
    .select()
    .from(projectAssignments)
    .where(
      and(
        eq(projectAssignments.memberId, memberId),
        eq(projectAssignments.projectId, projectId),
        isNull(projectAssignments.removedAt),
      ),
    )
    .get();
}

export function createProjectAssignment(db: KosuDatabase, input: ProjectAssignmentInsert) {
  return db
    .insert(projectAssignments)
    .values({
      id: createId(),
      memberId: input.memberId,
      projectId: input.projectId,
      assignmentRole: input.assignmentRole ?? null,
      assignmentSource: input.assignmentSource ?? "admin",
    })
    .returning()
    .get();
}

export function updateProjectAssignment(db: KosuDatabase, id: string, input: ProjectAssignmentUpdate) {
  return db
    .update(projectAssignments)
    .set({
      assignmentRole: input.assignmentRole,
      assignmentSource: input.assignmentSource,
    })
    .where(eq(projectAssignments.id, id))
    .returning()
    .get();
}

export function removeProjectAssignment(db: KosuDatabase, id: string, removedAt: string) {
  return db
    .update(projectAssignments)
    .set({ removedAt })
    .where(eq(projectAssignments.id, id))
    .returning()
    .get();
}

export function listActiveAssignmentsByMember(db: KosuDatabase, memberId: string) {
  return db
    .select()
    .from(projectAssignments)
    .where(and(eq(projectAssignments.memberId, memberId), isNull(projectAssignments.removedAt)))
    .orderBy(asc(projectAssignments.assignedAt))
    .all();
}

export function listSelfAssignedProjectIds(db: KosuDatabase) {
  return db
    .select({ memberId: projectAssignments.memberId, projectId: projectAssignments.projectId })
    .from(projectAssignments)
    .where(and(eq(projectAssignments.assignmentSource, "self_assigned"), isNull(projectAssignments.removedAt)))
    .all();
}
