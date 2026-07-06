import { and, asc, eq, gte, isNull, like, lte } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { dailyWorkLogs, effortAllocations, members, monthlyPlans, projects, tasks } from "../schema";
import type { ProjectType } from "./projects";

export type EffortAllocationInsert = {
  dailyWorkLogId: string;
  memberId: string;
  projectId: string;
  taskId?: string | null;
  allocatedHours: number;
  note?: string | null;
  hourlyCostRateSnapshot?: number | null;
};

export type EffortAllocationUpdate = Partial<EffortAllocationInsert>;

export function listAllocationsByWorkLog(db: KosuDatabase, dailyWorkLogId: string) {
  return db
    .select()
    .from(effortAllocations)
    .where(and(eq(effortAllocations.dailyWorkLogId, dailyWorkLogId), isNull(effortAllocations.deletedAt)))
    .orderBy(asc(effortAllocations.createdAt))
    .all();
}

export function listAllocationsByMember(db: KosuDatabase, memberId: string) {
  return db
    .select()
    .from(effortAllocations)
    .where(and(eq(effortAllocations.memberId, memberId), isNull(effortAllocations.deletedAt)))
    .orderBy(asc(effortAllocations.createdAt))
    .all();
}

export function listAllocationsByProject(db: KosuDatabase, projectId: string) {
  return db
    .select()
    .from(effortAllocations)
    .where(and(eq(effortAllocations.projectId, projectId), isNull(effortAllocations.deletedAt)))
    .orderBy(asc(effortAllocations.createdAt))
    .all();
}

export function findAllocationById(db: KosuDatabase, id: string) {
  return db.select().from(effortAllocations).where(eq(effortAllocations.id, id)).get();
}

export function createEffortAllocation(db: KosuDatabase, input: EffortAllocationInsert) {
  return db
    .insert(effortAllocations)
    .values({
      id: createId(),
      dailyWorkLogId: input.dailyWorkLogId,
      memberId: input.memberId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      allocatedHours: input.allocatedHours,
      note: input.note ?? null,
      hourlyCostRateSnapshot: input.hourlyCostRateSnapshot ?? null,
    })
    .returning()
    .get();
}

export function updateEffortAllocation(db: KosuDatabase, id: string, input: EffortAllocationUpdate) {
  return db
    .update(effortAllocations)
    .set({
      projectId: input.projectId,
      taskId: input.taskId,
      allocatedHours: input.allocatedHours,
      note: input.note,
      hourlyCostRateSnapshot: input.hourlyCostRateSnapshot,
    })
    .where(eq(effortAllocations.id, id))
    .returning()
    .get();
}

export function deleteEffortAllocation(db: KosuDatabase, id: string, deletedAt: string) {
  return db.update(effortAllocations).set({ deletedAt }).where(eq(effortAllocations.id, id)).returning().get();
}

export type EffortReportFilters = {
  startDate?: string;
  endDate?: string;
  month?: string;
  memberId?: string;
  departmentName?: string;
  role?: string;
  projectId?: string;
  projectType?: string;
  taskId?: string;
};

export function listEffortReportRows(db: KosuDatabase, filters: EffortReportFilters) {
  const conditions = [isNull(effortAllocations.deletedAt), isNull(dailyWorkLogs.deletedAt)];

  if (filters.startDate && filters.endDate) {
    conditions.push(gte(dailyWorkLogs.workDate, filters.startDate), lte(dailyWorkLogs.workDate, filters.endDate));
  } else if (filters.startDate) {
    conditions.push(gte(dailyWorkLogs.workDate, filters.startDate));
  } else if (filters.endDate) {
    conditions.push(lte(dailyWorkLogs.workDate, filters.endDate));
  }
  if (filters.month) {
    conditions.push(like(dailyWorkLogs.workDate, `${filters.month}%`));
  }
  if (filters.memberId) {
    conditions.push(eq(effortAllocations.memberId, filters.memberId));
  }
  if (filters.departmentName) {
    conditions.push(eq(members.departmentName, filters.departmentName));
  }
  if (filters.role) {
    conditions.push(eq(members.role, filters.role as "admin" | "member"));
  }
  if (filters.projectId) {
    conditions.push(eq(effortAllocations.projectId, filters.projectId));
  }
  if (filters.projectType) {
    conditions.push(eq(projects.projectType, filters.projectType as ProjectType));
  }
  if (filters.taskId) {
    conditions.push(eq(effortAllocations.taskId, filters.taskId));
  }

  return db
    .select({
      allocationId: effortAllocations.id,
      memberId: members.id,
      memberName: members.displayName,
      departmentName: members.departmentName,
      role: members.role,
      projectId: projects.id,
      projectCode: projects.code,
      projectName: projects.name,
      projectType: projects.projectType,
      taskId: tasks.id,
      taskName: tasks.name,
      workDate: dailyWorkLogs.workDate,
      allocatedHours: effortAllocations.allocatedHours,
      hourlyCostRateSnapshot: effortAllocations.hourlyCostRateSnapshot,
      note: effortAllocations.note,
    })
    .from(effortAllocations)
    .innerJoin(dailyWorkLogs, eq(effortAllocations.dailyWorkLogId, dailyWorkLogs.id))
    .innerJoin(members, eq(effortAllocations.memberId, members.id))
    .innerJoin(projects, eq(effortAllocations.projectId, projects.id))
    .leftJoin(tasks, eq(effortAllocations.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(asc(dailyWorkLogs.workDate), asc(members.displayName), asc(projects.code))
    .all();
}

export function listPlannedVsActualByMonth(db: KosuDatabase, month: string) {
  const allocations = db
    .select({
      memberId: effortAllocations.memberId,
      projectId: effortAllocations.projectId,
      allocatedHours: effortAllocations.allocatedHours,
    })
    .from(effortAllocations)
    .innerJoin(dailyWorkLogs, eq(effortAllocations.dailyWorkLogId, dailyWorkLogs.id))
    .where(and(isNull(effortAllocations.deletedAt), isNull(dailyWorkLogs.deletedAt), like(dailyWorkLogs.workDate, `${month}%`)))
    .all();

  const plans = db
    .select({
      memberId: monthlyPlans.memberId,
      projectId: monthlyPlans.projectId,
      assignmentRole: monthlyPlans.assignmentRole,
      plannedHours: monthlyPlans.plannedHours,
    })
    .from(monthlyPlans)
    .where(eq(monthlyPlans.month, month))
    .all();

  return { allocations, plans };
}
