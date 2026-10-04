import { and, asc, eq, exists, isNull, or } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { dailyWorkLogs, effortAllocations, projects } from "../schema";

export type ProjectType = "billable" | "internal" | "non_billable";

export type ProjectInsert = {
  code: string;
  name: string;
  projectType: ProjectType;
  clientName?: string | null;
  description?: string | null;
  revenueOrBudgetAmount?: number | null;
  contractRevenueAmount?: number | null;
  laborCostBudgetAmount?: number | null;
  effortBudgetHours?: number | null;
};

export type ProjectUpdate = Partial<ProjectInsert>;

export function listProjects(db: KosuDatabase) {
  return db.select().from(projects).orderBy(asc(projects.code)).all();
}

// Historical report choices must not change active-only input choices.
export function listEffortReportProjects(db: KosuDatabase, memberId?: string) {
  const ownEffort = db
    .select({ id: effortAllocations.id })
    .from(effortAllocations)
    .innerJoin(
      dailyWorkLogs,
      eq(effortAllocations.dailyWorkLogId, dailyWorkLogs.id),
    )
    .where(
      and(
        eq(effortAllocations.projectId, projects.id),
        memberId ? eq(effortAllocations.memberId, memberId) : undefined,
        isNull(effortAllocations.deletedAt),
        isNull(dailyWorkLogs.deletedAt),
      ),
    );
  return db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      isArchived: projects.isArchived,
    })
    .from(projects)
    .where(
      memberId
        ? or(eq(projects.isArchived, false), exists(ownEffort))
        : undefined,
    )
    .orderBy(asc(projects.isArchived), asc(projects.code))
    .all();
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
      contractRevenueAmount: input.contractRevenueAmount ?? null,
      laborCostBudgetAmount: input.laborCostBudgetAmount ?? null,
      effortBudgetHours: input.effortBudgetHours ?? null,
    })
    .returning()
    .get();
}

export function updateProject(
  db: KosuDatabase,
  id: string,
  input: ProjectUpdate,
) {
  return db
    .update(projects)
    .set({
      code: input.code,
      name: input.name,
      projectType: input.projectType,
      clientName: input.clientName,
      description: input.description,
      revenueOrBudgetAmount: input.revenueOrBudgetAmount,
      contractRevenueAmount: input.contractRevenueAmount,
      laborCostBudgetAmount: input.laborCostBudgetAmount,
      effortBudgetHours: input.effortBudgetHours,
    })
    .where(eq(projects.id, id))
    .returning()
    .get();
}

export function archiveProject(
  db: KosuDatabase,
  id: string,
  archivedAt: string,
) {
  return db
    .update(projects)
    .set({ isArchived: true, archivedAt })
    .where(eq(projects.id, id))
    .returning()
    .get();
}

export function unarchiveProject(db: KosuDatabase, id: string) {
  return db
    .update(projects)
    .set({ isArchived: false, archivedAt: null })
    .where(eq(projects.id, id))
    .returning()
    .get();
}

export function listActiveProjects(db: KosuDatabase) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.isArchived, false))
    .orderBy(asc(projects.code))
    .all();
}

export function findActiveProjectByCode(db: KosuDatabase, code: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.code, code), eq(projects.isArchived, false)))
    .get();
}

export function withoutProjectFinancials<
  T extends {
    contractRevenueAmount?: unknown;
    laborCostBudgetAmount?: unknown;
    revenueOrBudgetAmount?: unknown;
  },
>(project: T) {
  const publicProject = { ...project };
  delete publicProject.contractRevenueAmount;
  delete publicProject.laborCostBudgetAmount;
  delete publicProject.revenueOrBudgetAmount;
  return publicProject;
}
