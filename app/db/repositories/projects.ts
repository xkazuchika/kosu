import { and, asc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { projects } from "../schema";

export type ProjectType = "billable" | "internal" | "non_billable";

export type ProjectInsert = {
  code: string;
  name: string;
  projectType: ProjectType;
  clientName?: string | null;
  description?: string | null;
  revenueOrBudgetAmount?: number | null;
};

export type ProjectUpdate = Partial<ProjectInsert>;

export function listProjects(db: KosuDatabase) {
  return db.select().from(projects).orderBy(asc(projects.code)).all();
}

export function findProjectById(db: KosuDatabase, id: string) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function findProjectByCode(db: KosuDatabase, code: string) {
  return db.select().from(projects).where(eq(projects.code, code)).get();
}

export function createProject(db: KosuDatabase, input: ProjectInsert) {
  return db
    .insert(projects)
    .values({
      id: createId(),
      code: input.code,
      name: input.name,
      projectType: input.projectType,
      clientName: input.clientName ?? null,
      description: input.description ?? null,
      revenueOrBudgetAmount: input.revenueOrBudgetAmount ?? null,
    })
    .returning()
    .get();
}

export function updateProject(db: KosuDatabase, id: string, input: ProjectUpdate) {
  return db
    .update(projects)
    .set({
      code: input.code,
      name: input.name,
      projectType: input.projectType,
      clientName: input.clientName,
      description: input.description,
      revenueOrBudgetAmount: input.revenueOrBudgetAmount,
    })
    .where(eq(projects.id, id))
    .returning()
    .get();
}

export function archiveProject(db: KosuDatabase, id: string, archivedAt: string) {
  return db
    .update(projects)
    .set({ isArchived: true, archivedAt })
    .where(eq(projects.id, id))
    .returning()
    .get();
}

export function unarchiveProject(db: KosuDatabase, id: string) {
  return db.update(projects).set({ isArchived: false, archivedAt: null }).where(eq(projects.id, id)).returning().get();
}

export function listActiveProjects(db: KosuDatabase) {
  return db.select().from(projects).where(eq(projects.isArchived, false)).orderBy(asc(projects.code)).all();
}

export function findActiveProjectByCode(db: KosuDatabase, code: string) {
  return db.select().from(projects).where(and(eq(projects.code, code), eq(projects.isArchived, false))).get();
}
