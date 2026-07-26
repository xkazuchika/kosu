import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/daily-plans";

import { MonthlyCloseReadOnlyNotice, MonthlyCloseStatusBadge } from "~/components/monthly-close-status";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { listDailyAllocationPlansByMemberAndMonth } from "~/db/repositories/daily-allocation-plans";
import { listMembers, findMemberById, withoutMemberFinancials } from "~/db/repositories/members";
import { listMonthlyPlansByMemberAndMonth } from "~/db/repositories/monthly-plans";
import { listActiveAssignmentsByMember } from "~/db/repositories/project-assignments";
import { findProjectById, withoutProjectFinancials } from "~/db/repositories/projects";
import { getWeekdayLabel, isSaturdayDate, isSundayDate, isValidMonth, isWeekendDate, listMonthDates } from "~/lib/time";
import { DailyAllocationPlanError, copyDailyAllocationPlansToActuals, saveDailyAllocationPlans } from "~/services/daily-allocation-plans";
import { getSessionMember } from "~/services/auth";
import { getMonthlyCostCloseState } from "~/services/monthly-cost-close";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const { currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const month = requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const isAdmin = currentMember.role === "admin";
    const requestedMemberId = url.searchParams.get("memberId");
    const targetMemberId = isAdmin && requestedMemberId ? requestedMemberId : currentMember.id;
    const targetMember = findMemberById(db, targetMemberId);

    if (!targetMember) {
      throw new Response("Not found", { status: 404 });
    }

    const assignedProjectRecords = listActiveAssignmentsByMember(db, targetMemberId)
      .map((assignment) => findProjectById(db, assignment.projectId))
      .filter((project): project is NonNullable<typeof project> => project !== undefined && !project.isArchived);
    const assignedProjects = isAdmin ? assignedProjectRecords : assignedProjectRecords.map(withoutProjectFinancials);
    const monthlyPlans = listMonthlyPlansByMemberAndMonth(db, targetMemberId, month);
    const dailyPlans = listDailyAllocationPlansByMemberAndMonth(db, targetMemberId, month);
    const requestedProjectIds = url.searchParams.getAll("projectId");
    const defaultProjectIds = new Set([...monthlyPlans.map((plan) => plan.projectId), ...dailyPlans.map((plan) => plan.projectId)]);
    const visibleProjectIds = requestedProjectIds.length > 0
      ? new Set(requestedProjectIds)
      : defaultProjectIds.size > 0
        ? defaultProjectIds
        : new Set(assignedProjects.map((project) => project.id));
    const columnProjects = assignedProjects.filter((project) => visibleProjectIds.has(project.id));
    const dailyPlanMap = new Map(dailyPlans.map((plan) => [`${plan.planDate}|${plan.projectId}`, plan]));
    const rowTotals = new Map<string, number>();

    for (const plan of dailyPlans) {
      rowTotals.set(plan.planDate, (rowTotals.get(plan.planDate) ?? 0) + plan.plannedHours);
    }

    const rows = listMonthDates(month).map((planDate) => ({
      isSaturday: isSaturdayDate(planDate),
      isSunday: isSundayDate(planDate),
      isWeekend: isWeekendDate(planDate),
      planDate,
      weekday: getWeekdayLabel(planDate),
      totalPlannedHours: rowTotals.get(planDate) ?? 0,
    }));
    const monthlyTotal = monthlyPlans.reduce((sum, plan) => sum + plan.plannedHours, 0);
    const dailyTotal = dailyPlans.reduce((sum, plan) => sum + plan.plannedHours, 0);

    const closeState = getMonthlyCostCloseState(db, month);

    return {
      assignedProjects,
      columnProjects,
      currentMemberId: currentMember.id,
      dailyPlanValues: Object.fromEntries(dailyPlanMap.entries()),
      dailyTotal,
      difference: dailyTotal - monthlyTotal,
      isAdmin,
      isLocked: closeState.isProtected,
      closeStatus: closeState.status,
      members: isAdmin ? listMembers(db).map(withoutMemberFinancials) : [],
      month,
      monthlyTotal,
      rows,
      targetMember: withoutMemberFinancials(targetMember),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const formData = await request.formData();
    const { currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = String(formData.get("month") ?? url.searchParams.get("month") ?? "");
    const month = isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const isAdmin = currentMember.role === "admin";
    const requestedMemberId = String(formData.get("memberId") ?? url.searchParams.get("memberId") ?? "");
    const targetMemberId = isAdmin && requestedMemberId ? requestedMemberId : currentMember.id;
    const intent = String(formData.get("intent") ?? "save");

    if (targetMemberId !== currentMember.id && !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    if (intent === "copy") {
      const copySummary = copyDailyAllocationPlansToActuals(db, { memberId: targetMemberId, month });
      return { copySummary };
    }

    const dates = formData.getAll("planDate").map(String);
    const projectIds = formData.getAll("projectId").map(String);
    const plannedHoursValues = formData.getAll("plannedHours").map(String);
    const cells = dates.map((planDate, index) => ({
      planDate,
      projectId: projectIds[index] ?? "",
      plannedHours: plannedHoursValues[index] ?? "",
    }));
    const saveSummary = saveDailyAllocationPlans(db, { memberId: targetMemberId, month, cells });

    return { saveSummary };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    if (error instanceof DailyAllocationPlanError) {
      return { error: error.message };
    }
    return { error: "日別予定工数の保存に失敗しました。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "日別予定工数入力 | kosu" }];

export default function DailyPlans() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData() as
    | {
        copySummary?: { copiedDates: number; createdAllocations: number; skippedExistingActualDates: number; skippedNoPlanDates: number };
        error?: string;
        saveSummary?: { deleted: number; upserted: number };
      }
    | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">日別予定工数入力</h1>
          <p className="text-sm text-slate-600">
            {data.targetMember.displayName} · {data.month} · いつ、どの案件に、何時間入る予定かを入力します。空欄または0は予定なしです。
          </p>
        </div>
        <MonthlyCloseStatusBadge status={data.closeStatus} />
      </div>

      {actionData?.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </p>
      ) : null}
      {actionData?.saveSummary ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          日別予定工数を保存しました（更新 {actionData.saveSummary.upserted} 件 / 削除 {actionData.saveSummary.deleted} 件）。
        </p>
      ) : null}
      {actionData?.copySummary ? (
        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800" role="status">
          実績工数へ反映しました（反映日 {actionData.copySummary.copiedDates} 日 / 作成実績工数 {actionData.copySummary.createdAllocations} 件 / 実績工数ありスキップ {actionData.copySummary.skippedExistingActualDates} 日 / 予定工数なし {actionData.copySummary.skippedNoPlanDates} 日）。
        </p>
      ) : null}
      <MonthlyCloseReadOnlyNotice month={data.month} status={data.closeStatus} />

      <Card>
        <CardHeader>
          <CardTitle>対象</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="space-y-4" method="get">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {data.isAdmin ? (
                <div>
                  <label className="text-sm font-medium text-slate-800">対象メンバー</label>
                  <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={data.targetMember.id} name="memberId">
                    {data.members.map((member) => (
                      <option key={member.id} value={member.id}>{member.displayName}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="text-sm font-medium text-slate-800">月</label>
                <Input className="mt-1" defaultValue={data.month} name="month" type="month" />
              </div>
              <Button type="submit" variant="primary">表示</Button>
            </div>
            {data.assignedProjects.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">表示案件</label>
                <div className="flex flex-wrap gap-3 rounded-lg bg-slate-50 p-3">
                  {data.assignedProjects.map((project) => (
                    <label className="flex items-center gap-2 text-sm text-slate-700" key={project.id}>
                      <input defaultChecked={data.columnProjects.some((item) => item.id === project.id)} name="projectId" type="checkbox" value={project.id} />
                      {project.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </Form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="日別予定工数合計" value={`${data.dailyTotal}h`} />
        <SummaryCard label="月次予定工数合計" value={`${data.monthlyTotal}h`} />
        <SummaryCard label="差分（日別 - 月次）" value={`${data.difference >= 0 ? "+" : ""}${data.difference}h`} tone={data.difference === 0 ? "neutral" : "warning"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>予定工数入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">空欄または0は予定なしとして保存時に削除されます。1日の合計は24h以下、入力は0.25h単位です。</p>
          {data.assignedProjects.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">担当案件がありません。先に案件へアサインしてください。</p>
          ) : data.columnProjects.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">表示する案件を選択してください。</p>
          ) : (
            <Form method="post">
              <input name="month" type="hidden" value={data.month} />
              <input name="memberId" type="hidden" value={data.targetMember.id} />
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">日付</th>
                      <th className="border-b border-slate-200 px-3 py-3">曜日</th>
                      {data.columnProjects.map((project) => (
                        <th className="min-w-36 border-b border-slate-200 px-3 py-3 text-right" key={project.id}>{project.name}</th>
                      ))}
                      <th className="border-b border-slate-200 px-3 py-3 text-right">日合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr className={`border-b border-slate-100 ${row.isSunday ? "bg-rose-50/45" : row.isSaturday ? "bg-indigo-50/35" : ""}`} key={row.planDate}>
                        <td className={`sticky left-0 px-3 py-2 font-medium ${row.isSunday ? "bg-rose-50 text-rose-900" : row.isSaturday ? "bg-indigo-50 text-indigo-900" : "bg-white"}`}>{row.planDate.slice(5)}</td>
                        <td className={`px-3 py-2 ${row.isSunday ? "font-medium text-rose-700" : row.isSaturday ? "font-medium text-indigo-700" : "text-slate-600"}`}>{row.weekday}</td>
                        {data.columnProjects.map((project) => {
                          const plan = data.dailyPlanValues[`${row.planDate}|${project.id}`];

                          return (
                            <td className="px-3 py-2 text-right" key={project.id}>
                              <input name="planDate" type="hidden" value={row.planDate} />
                              <input name="projectId" type="hidden" value={project.id} />
                              <Input
                                className="w-24 text-right"
                                defaultValue={plan?.plannedHours ?? ""}
                                disabled={data.isLocked}
                                name="plannedHours"
                                step="0.25"
                                type="number"
                              />
                            </td>
                          );
                        })}
                        <td className={`px-3 py-2 text-right font-medium ${row.totalPlannedHours > 24 ? "text-red-700" : "text-slate-700"}`}>{row.totalPlannedHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button disabled={data.isLocked} type="submit" variant="primary">日別予定工数を保存</Button>
              </div>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>保存済みの予定工数を実績工数へ反映</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            保存済みの日別予定工数から、案件別実績工数がまだない日の実績工数を作成します。画面上で編集中の内容は、先に「日別予定工数を保存」してください。
          </p>
          <Form method="post">
            <input name="intent" type="hidden" value="copy" />
            <input name="month" type="hidden" value={data.month} />
            <input name="memberId" type="hidden" value={data.targetMember.id} />
            <Button disabled={data.isLocked} type="submit" variant="secondary">保存済み予定工数を実績工数へ反映</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "warning"; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-semibold ${tone === "warning" ? "text-amber-700" : "text-slate-950"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
