import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/monthly-plans";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { findCapacityByMemberAndMonth } from "~/db/repositories/member-monthly-capacities";
import { listMonthlyPlansByMember } from "~/db/repositories/monthly-plans";
import { getSessionMember } from "~/services/auth";
import { isMonthLocked } from "~/services/period-lock";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const currentMonth = "2026-07";
    const capacity = findCapacityByMemberAndMonth(db, member.id, currentMonth);
    const plans = listMonthlyPlansByMember(db, member.id);
    const totalPlanned = plans.reduce((sum, plan) => sum + plan.plannedHours, 0);
    const capacityHours = capacity?.capacityHours ?? 0;
    const variance = capacityHours - totalPlanned;

    return {
      member,
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

export const meta: Route.MetaFunction = () => [{ title: "月次計画 | kosu" }];

export default function MonthlyPlans() {
  const { currentMonth, isLocked, capacityHours, totalPlanned, variance, plans } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">月次計画</h1>
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
      <div className="flex flex-wrap gap-2">
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/work-logs/month?month=${currentMonth}`}>
          月次一括入力
        </Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/reports/planned-vs-actual?month=${currentMonth}`}>
          予定対実績
        </Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/monthly-plans/admin?month=${currentMonth}`}>
          案件別予定を入力
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>月次稼働予定時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{capacityHours}h</p>
          </CardContent>
        </Card>
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
            <CardTitle>残り / 超過</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold ${variance < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {variance >= 0 ? `+${variance}h` : `${variance}h`}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={["対象月", "案件", "担当ロール", "予定工数"]}
        emptyMessage={`${currentMonth} の月次計画はまだありません。`}
        rows={plans.map((plan) => [
          plan.month,
          plan.projectId,
          plan.assignmentRole || "-",
          `${plan.plannedHours}h`,
        ])}
      />
    </div>
  );
}
