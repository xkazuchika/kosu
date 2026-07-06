import { and, asc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { tasks } from "../schema";

export type TaskInsert = {
  projectId: string;
  name: string;
};

export type TaskUpdate = Partial<TaskInsert>;

export function listTasksByProject(db: KosuDatabase, projectId: string) {
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.name)).all();
}

export function findTaskById(db: KosuDatabase, id: string) {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

export function createTask(db: KosuDatabase, input: TaskInsert) {
  return db
    .insert(tasks)
    .values({ id: createId(), projectId: input.projectId, name: input.name })
    .returning()
    .get();
}

export function updateTask(db: KosuDatabase, id: string, input: TaskUpdate) {
  return db
    .update(tasks)
    .set({ projectId: input.projectId, name: input.name })
    .where(eq(tasks.id, id))
    .returning()
    .get();
}

export function archiveTask(db: KosuDatabase, id: string, archivedAt: string) {
  return db.update(tasks).set({ isArchived: true, archivedAt }).where(eq(tasks.id, id)).returning().get();
}

export function unarchiveTask(db: KosuDatabase, id: string) {
  return db.update(tasks).set({ isArchived: false, archivedAt: null }).where(eq(tasks.id, id)).returning().get();
}

export function listActiveTasksByProject(db: KosuDatabase, projectId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.isArchived, false)))
    .orderBy(asc(tasks.name))
    .all();
}
