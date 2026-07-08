import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/monthly-plans";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { findCapacityByMemberAndMonth } from "~/db/repositories/member-monthly-capacities";
import { listMonthlyPlansByMemberAndMonth } from "~/db/repositories/monthly-plans";
import { findProjectById } from "~/db/repositories/projects";
import { isValidMonth } from "~/lib/time";
import { getSessionMember } from "~/services/auth";
import { isMonthLocked } from "~/services/period-lock";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const requestedMonth = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const currentMonth = isValidMonth(requestedMonth) ? requestedMonth : new Date().toISOString().slice(0, 7);
    const capacity = findCapacityByMemberAndMonth(db, member.id, currentMonth);
    const plans = listMonthlyPlansByMemberAndMonth(db, member.id, currentMonth).map((plan) => ({
      ...plan,
      projectName: findProjectById(db, plan.projectId)?.name ?? plan.projectId,
    }));
    const totalPlanned = plans.reduce((sum, plan) => sum + plan.plannedHours, 0);
    const capacityHours = capacity?.capacityHours ?? null;
    const variance = capacityHours === null ? null : capacityHours - totalPlanned;

    return {
      member,
      isAdmin: member.role === "admin",
      currentMonth,
      isLocked: isMonthLocked(db, currentMonth),
      capacityHours,
      totalPlanned,
      variance,
      plans,
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "月次予定 | kosu" }];

export default function MonthlyPlans() {
  const { currentMonth, isAdmin, isLocked, capacityHours, totalPlanned, variance, plans } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">月次予定</h1>
        {isLocked ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            ロック中
          </span>
        ) : (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            編集可能
          </span>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>対象月</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="get">
            <div>
              <label className="text-sm font-medium text-slate-800">月</label>
              <Input className="mt-1" defaultValue={currentMonth} name="month" type="month" />
            </div>
            <Button type="submit" variant="primary">表示</Button>
          </Form>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/work-logs/month?month=${currentMonth}`}>
          月次一括入力
        </Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/reports/planned-vs-actual?month=${currentMonth}`}>
          予定対実績
        </Link>
        {isAdmin ? (
          <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/monthly-plans/admin?month=${currentMonth}`}>
            月次予定を入力
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>予定工数合計</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{totalPlanned}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>任意: 稼働予定時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{capacityHours === null ? "未設定" : `${capacityHours}h`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>稼働予定との差分</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold ${variance !== null && variance < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {variance === null ? "-" : variance >= 0 ? `+${variance}h` : `${variance}h`}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={["対象月", "案件", "担当ロール", "予定工数"]}
        emptyMessage={`${currentMonth} の月次予定はまだありません。`}
        rows={plans.map((plan) => [
          plan.month,
          plan.projectName,
          plan.assignmentRole || "-",
          `${plan.plannedHours}h`,
        ])}
      />
    </div>
  );
}
