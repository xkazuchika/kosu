import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { createDatabaseConnection } from "~/db/client";
import { findDailyWorkLogByMemberAndDate, listDailyWorkLogsByMemberAndMonth } from "~/db/repositories/daily-work-logs";
import { listAllocationsByProject, listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { findCapacityByMemberAndMonth } from "~/db/repositories/member-monthly-capacities";
import { listMembers } from "~/db/repositories/members";
import { listMonthlyPlansByMemberAndMonth, listMonthlyPlansByProject } from "~/db/repositories/monthly-plans";
import { findPeriodLockByMonth } from "~/db/repositories/period-locks";
import { listActiveAssignmentsByMember } from "~/db/repositories/project-assignments";
import { findProjectById, listActiveProjects } from "~/db/repositories/projects";
import { getSessionMember } from "~/services/auth";

type DashboardLoaderData = {
  isAdmin: boolean;
  today: string;
  currentMonth: string;
  todayInput: {
    hasEntry: boolean;
    totalWorkingHours: number;
    allocatedHours: number;
  };
  monthlySummary: {
    capacityHours: number | null;
    plannedHours: number;
    actualHours: number;
    unallocatedHours: number;
  };
  assignedProjects: { id: string; name: string; code: string }[];
  incompleteAllocationsCount: number;
  isLocked: boolean;
  teamInputStatus: { total: number; withEntry: number; withIncompleteAllocation: number } | null;
  memberTodayStatuses: { memberId: string; displayName: string; hasEntry: boolean; hasIncompleteAllocation: boolean }[] | null;
  projectSummaries: {
    id: string;
    name: string;
    code: string;
    projectType: string;
    plannedHours: number;
    actualHours: number;
  }[] | null;
  overplannedMembers: { memberId: string; displayName: string; capacityHours: number; plannedHours: number; overplannedHours: number }[] | null;
};

export const loader = async ({ request }: { request: Request }): Promise<DashboardLoaderData> => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const isAdmin = member.role === "admin";

    const todayLog = findDailyWorkLogByMemberAndDate(db, member.id, today);
    const monthLogs = listDailyWorkLogsByMemberAndMonth(db, member.id, currentMonth);
    const actualHours = sumAllocationsForLogs(db, monthLogs.map((log) => log.id));
    const capacity = findCapacityByMemberAndMonth(db, member.id, currentMonth);
    const plans = listMonthlyPlansByMemberAndMonth(db, member.id, currentMonth);
    const plannedHours = plans.reduce((sum: number, p) => sum + p.plannedHours, 0);
    const assignedProjects = listActiveAssignmentsByMember(db, member.id)
      .map((a) => findProjectById(db, a.projectId))
      .filter((p): p is NonNullable<typeof p> => p !== undefined && !p.isArchived);

    const incompleteAllocationsCount = monthLogs.filter((log) => {
      const allocated = listAllocationsByWorkLog(db, log.id).reduce((sum: number, a) => sum + a.allocatedHours, 0);
      return log.totalWorkingHours - allocated !== 0;
    }).length;

    const base: DashboardLoaderData = {
      isAdmin,
      today,
      currentMonth,
      todayInput: {
        hasEntry: todayLog !== null,
        totalWorkingHours: todayLog?.totalWorkingHours ?? 0,
        allocatedHours: todayLog
          ? listAllocationsByWorkLog(db, todayLog.id).reduce((sum: number, a) => sum + a.allocatedHours, 0)
          : 0,
      },
      monthlySummary: {
        capacityHours: capacity?.capacityHours ?? null,
        plannedHours,
        actualHours,
        unallocatedHours: actualHours - plannedHours,
      },
      assignedProjects: assignedProjects.map((p) => ({ id: p.id, name: p.name, code: p.code })),
      incompleteAllocationsCount,
      isLocked: !!findPeriodLockByMonth(db, currentMonth)?.isLocked,
      teamInputStatus: null,
      memberTodayStatuses: null,
      projectSummaries: null,
      overplannedMembers: null,
    };

    if (!isAdmin) {
      return base;
    }

    const allMembers = listMembers(db);
    const activeMembers = allMembers.filter((m) => m.isActive);
    const activeProjects = listActiveProjects(db);

    const memberTodayStatuses = activeMembers.map((m) => {
      const log = findDailyWorkLogByMemberAndDate(db, m.id, today);
      return {
        memberId: m.id,
        displayName: m.displayName,
        hasEntry: log !== null,
        hasIncompleteAllocation: log
          ? log.totalWorkingHours -
              listAllocationsByWorkLog(db, log.id).reduce((sum: number, a) => sum + a.allocatedHours, 0) !==
            0
          : false,
      };
    });

    const projectSummaries = activeProjects.map((project) => {
      const projectAllocations = listAllocationsByProjectForMonth(db, project.id, currentMonth);
      const projectPlans = listMonthlyPlansByProject(db, project.id).filter((p) => p.month === currentMonth);
      const actual = projectAllocations.reduce((sum: number, a) => sum + a.allocatedHours, 0);
      const planned = projectPlans.reduce((sum: number, p) => sum + p.plannedHours, 0);

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        projectType: project.projectType,
        plannedHours: planned,
        actualHours: actual,
      };
    });

    const overplannedMembers = activeMembers
      .map((m) => {
        const cap = findCapacityByMemberAndMonth(db, m.id, currentMonth);
        const memberPlans = listMonthlyPlansByMemberAndMonth(db, m.id, currentMonth);
        const planned = memberPlans.reduce((sum: number, p) => sum + p.plannedHours, 0);
        return {
          memberId: m.id,
          displayName: m.displayName,
          capacityHours: cap?.capacityHours ?? 0,
          plannedHours: planned,
          overplannedHours: cap && planned > cap.capacityHours ? planned - cap.capacityHours : 0,
        };
      })
      .filter((m) => m.overplannedHours > 0);

    return {
      ...base,
      teamInputStatus: {
        total: activeMembers.length,
        withEntry: memberTodayStatuses.filter((s) => s.hasEntry).length,
        withIncompleteAllocation: memberTodayStatuses.filter((s) => s.hasIncompleteAllocation).length,
      },
      memberTodayStatuses,
      projectSummaries,
      overplannedMembers,
    };
  } finally {
    sqlite.close();
  }
};

function sumAllocationsForLogs(db: ReturnType<typeof createDatabaseConnection>["db"], logIds: string[]) {
  return logIds.reduce((sum: number, logId) => {
    return sum + listAllocationsByWorkLog(db, logId).reduce((inner: number, a) => inner + a.allocatedHours, 0);
  }, 0);
}

function listAllocationsByProjectForMonth(
  db: ReturnType<typeof createDatabaseConnection>["db"],
  projectId: string,
  month: string,
) {
  const allLogIds: string[] = [];
  for (const m of listMembers(db)) {
    allLogIds.push(...listDailyWorkLogsByMemberAndMonth(db, m.id, month).map((log) => log.id));
  }
  const logIdSet = new Set(allLogIds);
  return listAllocationsByProject(db, projectId).filter((a) => logIdSet.has(a.dailyWorkLogId));
}

export const meta: Route.MetaFunction = () => [{ title: "ダッシュボード | kosu" }];

export default function Dashboard() {
  const data = useLoaderData<DashboardLoaderData>();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">ダッシュボード</h1>
        {data.isLocked ? (
          <Badge tone="danger">{data.currentMonth} ロック中</Badge>
        ) : (
          <Badge tone="success">{data.currentMonth} 編集可能</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="今日の入力" to={`/work-logs/${data.today}`}>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{data.todayInput.totalWorkingHours}h</span>
            <span className="text-sm text-slate-600">配賦 {data.todayInput.allocatedHours}h</span>
          </div>
          <div className="mt-2">
            {!data.todayInput.hasEntry ? (
              <Badge tone="warning">未入力</Badge>
            ) : data.todayInput.totalWorkingHours - data.todayInput.allocatedHours === 0 ? (
              <Badge tone="success">完了</Badge>
            ) : (
              <Badge tone="warning">未配分</Badge>
            )}
          </div>
        </SummaryCard>

        <SummaryCard label="今月の予定工数" to="/monthly-plans">
          <p className="text-3xl font-semibold">{data.monthlySummary.plannedHours}h</p>
          {data.monthlySummary.capacityHours !== null ? (
            <p className="mt-1 text-sm text-slate-600">キャパシティ {data.monthlySummary.capacityHours}h</p>
          ) : null}
        </SummaryCard>

        <SummaryCard label="今月の実績工数" to="/work-logs">
          <p className="text-3xl font-semibold">{data.monthlySummary.actualHours}h</p>
          {data.monthlySummary.unallocatedHours !== 0 ? (
            <p className="mt-1 text-sm text-amber-700">
              予定差分 {data.monthlySummary.unallocatedHours >= 0 ? "+" : ""}
              {data.monthlySummary.unallocatedHours}h
            </p>
          ) : null}
        </SummaryCard>
      </div>

      {data.incompleteAllocationsCount > 0 ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          今月の未配分または過配賦の日が {data.incompleteAllocationsCount} 件あります。
          <Link className="ml-2 font-medium underline" to="/work-logs">
            日次工数を確認
          </Link>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>アサイン済み案件</CardTitle>
        </CardHeader>
        <CardContent>
          {data.assignedProjects.length === 0 ? (
            <EmptyState description="まだどの案件にもアサインされていません。" title="案件がありません" />
          ) : (
            <ul className="space-y-2">
              {data.assignedProjects.map((project) => (
                <li key={project.id}>
                  <Link className="text-sky-700 hover:underline" to={`/projects/${project.id}`}>
                    {project.code} {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.isAdmin ? <AdminDashboard data={data} /> : null}
    </div>
  );
}

function AdminDashboard({ data }: { data: DashboardLoaderData }) {
  return (
    <>
      <h2 className="text-xl font-semibold text-slate-950">管理者ダッシュボード</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="本日入力状況" to="/reports">
          <p className="text-3xl font-semibold">
            {data.teamInputStatus?.withEntry}/{data.teamInputStatus?.total}
          </p>
          <p className="text-sm text-slate-600">メンバー</p>
        </SummaryCard>

        <SummaryCard label="未配分・過配賦" to="/reports">
          <p className="text-3xl font-semibold">{data.teamInputStatus?.withIncompleteAllocation}</p>
          <p className="text-sm text-slate-600">メンバー</p>
        </SummaryCard>

        <SummaryCard label="予定超過メンバー" to="/monthly-plans/admin">
          <p className="text-3xl font-semibold">{data.overplannedMembers?.length}</p>
          <p className="text-sm text-slate-600">名</p>
        </SummaryCard>

        <SummaryCard label="アクティブ案件" to="/projects">
          <p className="text-3xl font-semibold">{data.projectSummaries?.length}</p>
          <p className="text-sm text-slate-600">件</p>
        </SummaryCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>案件サマリー（{data.currentMonth}）</CardTitle>
        </CardHeader>
        <CardContent>
          {data.projectSummaries?.length === 0 ? (
            <EmptyState description="アクティブな案件がありません。" title="案件がありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">案件</th>
                    <th className="py-2 pr-4">種別</th>
                    <th className="py-2 pr-4 text-right">予定</th>
                    <th className="py-2 pr-4 text-right">実績</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projectSummaries?.map((project) => (
                    <tr key={project.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">
                        <Link className="text-sky-700 hover:underline" to={`/projects/${project.id}`}>
                          {project.code} {project.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{project.projectType}</td>
                      <td className="py-2 pr-4 text-right">{project.plannedHours}h</td>
                      <td className="py-2 pr-4 text-right">{project.actualHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </>
  );
}

function SummaryCard({ children, label, to }: { children: React.ReactNode; label: string; to?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{to ? <Link to={to}>{label}</Link> : label}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
