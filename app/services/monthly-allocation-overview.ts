import { and, asc, eq, isNull } from "drizzle-orm";
import type { KosuDatabase } from "~/db/client";
import {
  members,
  projects,
  monthlyPlans,
  memberMonthlyCapacities,
  memberMonthlyPlanReviews,
  projectAssignments,
} from "~/db/schema";

// Read plans and revisions in one SQLite snapshot so confirmation cannot approve a stale view.
export function getMonthlyAllocationOverview(
  db: KosuDatabase,
  month: string,
  memberId?: string,
) {
  return db.transaction((tx) => {
    const people = tx
      .select({
        memberId: members.id,
        memberName: members.displayName,
        isActive: members.isActive,
      })
      .from(members)
      .where(memberId ? eq(members.id, memberId) : undefined)
      .orderBy(asc(members.displayName), asc(members.id))
      .all();
    const plans = tx
      .select({
        memberId: monthlyPlans.memberId,
        projectId: monthlyPlans.projectId,
        plannedHours: monthlyPlans.plannedHours,
        projectName: projects.name,
        projectCode: projects.code,
        projectType: projects.projectType,
        isArchived: projects.isArchived,
      })
      .from(monthlyPlans)
      .innerJoin(projects, eq(projects.id, monthlyPlans.projectId))
      .where(
        and(
          eq(monthlyPlans.month, month),
          memberId ? eq(monthlyPlans.memberId, memberId) : undefined,
        ),
      )
      .all();
    const capacities = tx
      .select({
        memberId: memberMonthlyCapacities.memberId,
        capacityHours: memberMonthlyCapacities.capacityHours,
      })
      .from(memberMonthlyCapacities)
      .where(
        and(
          eq(memberMonthlyCapacities.month, month),
          memberId ? eq(memberMonthlyCapacities.memberId, memberId) : undefined,
        ),
      )
      .all();
    const reviews = tx
      .select()
      .from(memberMonthlyPlanReviews)
      .where(
        and(
          eq(memberMonthlyPlanReviews.month, month),
          memberId
            ? eq(memberMonthlyPlanReviews.memberId, memberId)
            : undefined,
        ),
      )
      .all();
    const assignments = tx
      .select({
        memberId: projectAssignments.memberId,
        projectId: projectAssignments.projectId,
      })
      .from(projectAssignments)
      .where(
        and(
          isNull(projectAssignments.removedAt),
          memberId ? eq(projectAssignments.memberId, memberId) : undefined,
        ),
      )
      .all();
    const activeAssignments = new Set(
      assignments.map((a) => `${a.memberId}|${a.projectId}`),
    );
    const capacityMap = new Map(
      capacities.map((c) => [c.memberId, c.capacityHours]),
    );
    const reviewMap = new Map(reviews.map((r) => [r.memberId, r]));
    const byMember = new Map<
      string,
      Map<
        string,
        { projectId: string; plannedHours: number; assignmentRemoved: boolean }
      >
    >();
    const projectMap = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        projectCode: string;
        projectType: string;
        isArchived: boolean;
      }
    >();
    for (const plan of plans) {
      const cells = byMember.get(plan.memberId) ?? new Map();
      const cell = cells.get(plan.projectId) ?? {
        projectId: plan.projectId,
        plannedHours: 0,
        assignmentRemoved: !activeAssignments.has(
          `${plan.memberId}|${plan.projectId}`,
        ),
      };
      cell.plannedHours += plan.plannedHours;
      cells.set(plan.projectId, cell);
      byMember.set(plan.memberId, cells);
      projectMap.set(plan.projectId, {
        projectId: plan.projectId,
        projectName: plan.projectName,
        projectCode: plan.projectCode,
        projectType: plan.projectType,
        isArchived: plan.isArchived,
      });
    }
    const rows = people
      .filter(
        (p) =>
          p.isActive || byMember.has(p.memberId) || capacityMap.has(p.memberId),
      )
      .map((p) => {
        const cells = [...(byMember.get(p.memberId)?.values() ?? [])];
        const totalPlanned = cells.reduce((sum, c) => sum + c.plannedHours, 0);
        const capacityHours = capacityMap.get(p.memberId) ?? null;
        const balanceHours =
          capacityHours === null ? null : capacityHours - totalPlanned;
        const review = reviewMap.get(p.memberId);
        const isConfirmed = review?.confirmedAt != null;
        return {
          ...p,
          cells,
          totalPlanned,
          capacityHours,
          balanceHours,
          revision: review?.revision ?? 0,
          isConfirmed,
          confirmedAt: review?.confirmedAt ?? null,
          availableHours:
            p.isActive && isConfirmed && balanceHours !== null
              ? Math.max(balanceHours, 0)
              : null,
          overplannedHours:
            balanceHours === null ? null : Math.max(-balanceHours, 0),
        };
      });
    return {
      month,
      projects: [...projectMap.values()].sort((a, b) =>
        a.projectCode.localeCompare(b.projectCode),
      ),
      rows,
    };
  });
}
