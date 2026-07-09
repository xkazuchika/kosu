import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";
import { AlertTriangle, ArrowRight, BarChart3, CalendarClock, CheckCircle2, ClipboardList, FolderKanban, Route as RouteIcon, Sparkles } from "lucide-react";

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
  const todayVariance = data.todayInput.totalWorkingHours - data.todayInput.allocatedHours;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Today first</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-600">今日の入力、今月の状態、次に見るべきことを確認します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.isLocked ? (
            <Badge tone="danger">{data.currentMonth} ロック中</Badge>
          ) : (
            <Badge tone="success">{data.currentMonth} 編集可能</Badge>
          )}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70">
          <CardHeader className="border-indigo-100/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>今日の作業</CardTitle>
                <p className="mt-1 text-sm text-slate-600">{data.today} の実績工数を確認します。</p>
              </div>
              {!data.todayInput.hasEntry ? (
                <Badge tone="warning">未入力</Badge>
              ) : todayVariance === 0 ? (
                <Badge tone="success">完了</Badge>
              ) : (
                <Badge tone="warning">未割当</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="総稼働時間" value={`${data.todayInput.totalWorkingHours}h`} />
              <Metric label="実績工数" value={`${data.todayInput.allocatedHours}h`} />
              <Metric label="差分" tone={todayVariance === 0 ? "neutral" : "warning"} value={`${todayVariance >= 0 ? "+" : ""}${todayVariance}h`} />
            </div>
            <Link className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700" to={`/work-logs/${data.today}`}>
              今日の実績工数を入力
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <WorkflowMap />
      </section>

      <section className="space-y-3">
        <SectionHeading description="予定工数、実績工数、未割当を月単位で確認します。" title="今月の状態" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard icon={<CalendarClock className="h-4 w-4" />} label="予定工数" to="/monthly-plans">
            <p className="text-3xl font-semibold">{data.monthlySummary.plannedHours}h</p>
            {data.monthlySummary.capacityHours !== null ? (
              <p className="mt-1 text-sm text-slate-600">稼働可能時間 {data.monthlySummary.capacityHours}h</p>
            ) : null}
          </SummaryCard>

          <SummaryCard icon={<ClipboardList className="h-4 w-4" />} label="実績工数" to="/work-logs">
            <p className="text-3xl font-semibold">{data.monthlySummary.actualHours}h</p>
            {data.monthlySummary.unallocatedHours !== 0 ? (
              <p className="mt-1 text-sm text-amber-700">
                予定差分 {data.monthlySummary.unallocatedHours >= 0 ? "+" : ""}
                {data.monthlySummary.unallocatedHours}h
              </p>
            ) : null}
          </SummaryCard>

          <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="未割当・超過" to="/work-logs">
            <p className="text-3xl font-semibold">{data.incompleteAllocationsCount}</p>
            <p className="text-sm text-slate-600">日</p>
          </SummaryCard>
        </div>
      </section>

      {data.incompleteAllocationsCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          今月の未割当または超過の日が {data.incompleteAllocationsCount} 件あります。
          <Link className="ml-2 font-semibold underline" to="/work-logs">
            日別工数実績を確認
          </Link>
        </div>
      ) : null}

      <section className="space-y-3">
        <SectionHeading description="実績工数と予定工数の対象になる案件です。" title="担当案件" />
        <Card>
          <CardContent>
            {data.assignedProjects.length === 0 ? (
              <EmptyState actionHref="/self-assign" actionLabel="自己アサインへ" description="実績工数や予定工数を入力するには、先に案件へのアサインが必要です。" title="担当案件がありません" />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.assignedProjects.map((project) => (
                  <li key={project.id}>
                    <Link className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 hover:border-indigo-200 hover:bg-indigo-50/50" to={`/projects/${project.id}`}>
                      <FolderKanban aria-hidden className="h-4 w-4 text-indigo-500" />
                      <span>{project.code} {project.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {data.isAdmin ? <AdminDashboard data={data} /> : null}
    </div>
  );
}

function AdminDashboard({ data }: { data: DashboardLoaderData }) {
  return (
    <section className="space-y-4">
      <SectionHeading description="チームの入力状況と運用上の確認点です。" title="管理者ダッシュボード" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="本日入力状況" to="/reports">
          <p className="text-3xl font-semibold">
            {data.teamInputStatus?.withEntry}/{data.teamInputStatus?.total}
          </p>
          <p className="text-sm text-slate-600">メンバー</p>
        </SummaryCard>

        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="未割当・超過" to="/reports">
          <p className="text-3xl font-semibold">{data.teamInputStatus?.withIncompleteAllocation}</p>
          <p className="text-sm text-slate-600">メンバー</p>
        </SummaryCard>

        <SummaryCard icon={<BarChart3 className="h-4 w-4" />} label="予定超過メンバー" to="/monthly-plans/admin">
          <p className="text-3xl font-semibold">{data.overplannedMembers?.length}</p>
          <p className="text-sm text-slate-600">名</p>
        </SummaryCard>

        <SummaryCard icon={<FolderKanban className="h-4 w-4" />} label="アクティブ案件" to="/projects">
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
                        <Link className="text-indigo-700 hover:underline" to={`/projects/${project.id}`}>
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

    </section>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "warning"; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm shadow-slate-950/[0.03]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warning" ? "text-amber-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function WorkflowMap() {
  const steps = [
    { icon: <FolderKanban className="h-4 w-4" />, label: "Setup", text: "案件・メンバー" },
    { icon: <CalendarClock className="h-4 w-4" />, label: "Plan", text: "予定工数" },
    { icon: <ClipboardList className="h-4 w-4" />, label: "Actual", text: "実績工数" },
    { icon: <BarChart3 className="h-4 w-4" />, label: "Review", text: "分析" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <RouteIcon aria-hidden className="h-4 w-4 text-indigo-600" />
          <CardTitle>Workflow</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2">
          {steps.map((step, index) => (
            <li className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2" key={step.label}>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">{step.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-950">{step.label}</span>
                <span className="block text-xs text-slate-500">{step.text}</span>
              </span>
              {index === 0 ? <Sparkles aria-hidden className="h-4 w-4 text-indigo-400" /> : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ children, icon, label, to }: { children: React.ReactNode; icon?: React.ReactNode; label: string; to?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            {icon ? <span className="text-indigo-600" aria-hidden>{icon}</span> : null}
            {to ? <Link className="hover:text-indigo-700" to={to}>{label}</Link> : label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
