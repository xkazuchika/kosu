import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/monthly-plans";

import { MonthlyCloseStatusBadge } from "~/components/monthly-close-status";
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
import { getMonthlyCostCloseState } from "~/services/monthly-cost-close";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const workspaceCalendar = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const currentMonth =
      requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : workspaceCalendar.currentMonth;
    const capacity = findCapacityByMemberAndMonth(db, member.id, currentMonth);
    const plans = listMonthlyPlansByMemberAndMonth(db, member.id, currentMonth).map((plan) => ({
      ...plan,
      projectName: findProjectById(db, plan.projectId)?.name ?? plan.projectId,
    }));
    const totalPlanned = plans.reduce((sum, plan) => sum + plan.plannedHours, 0);
    const capacityHours = capacity?.capacityHours ?? null;
    const variance = capacityHours === null ? null : capacityHours - totalPlanned;

    const closeState = getMonthlyCostCloseState(db, currentMonth);

    return {
      member,
      isAdmin: member.role === "admin",
      currentMonth,
      closeStatus: closeState.status,
      capacityHours,
      totalPlanned,
      variance,
      plans,
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "月次予定工数 | kosu" }];

export default function MonthlyPlans() {
  const { closeStatus, currentMonth, capacityHours, totalPlanned, variance, plans } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">月次予定工数</h1>
          <p className="text-sm text-slate-600">今月の案件別予定工数と稼働可能時間の差分を確認します。</p>
        </div>
        <MonthlyCloseStatusBadge status={closeStatus} />
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
            <CardTitle>任意: 稼働可能時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{capacityHours === null ? "未設定" : `${capacityHours}h`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>稼働可能時間との差分</CardTitle>
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
        emptyMessage={`${currentMonth} の月次予定工数はまだありません。`}
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
