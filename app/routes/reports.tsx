import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/reports";

import { MonthlyCloseStatusBadge } from "~/components/monthly-close-status";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { createDatabaseConnection } from "~/db/client";
import { listEffortReportRows } from "~/db/repositories/effort-allocations";
import { listMembers, withoutMemberFinancials } from "~/db/repositories/members";
import { listActiveProjects, withoutProjectFinancials } from "~/db/repositories/projects";
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
    const { currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const month = requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const departmentName = url.searchParams.get("departmentName") ?? undefined;
    const role = url.searchParams.get("role") ?? undefined;
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const projectType = url.searchParams.get("projectType") ?? undefined;
    const memberId = member.role === "admin" ? (url.searchParams.get("memberId") ?? undefined) : member.id;

    const reportRows = listEffortReportRows(db, {
      month,
      memberId,
      departmentName,
      role,
      projectId,
      projectType,
    });
    const rows = reportRows.map((row) => ({ ...row, hourlyCostRateSnapshot: null }));

    const projects = member.role === "admin" ? listActiveProjects(db) : listActiveProjects(db).map(withoutProjectFinancials);
    const members = member.role === "admin" ? listMembers(db).map(withoutMemberFinancials) : [];

    return {
      closeStatus: getMonthlyCostCloseState(db, month).status,
      isAdmin: member.role === "admin",
      month,
      departmentName: departmentName ?? "",
      role: role ?? "",
      projectId: projectId ?? "",
      projectType: projectType ?? "",
      memberId: memberId ?? "",
      rows,
      projects,
      members,
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const { currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const month = requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const departmentName = url.searchParams.get("departmentName") ?? undefined;
    const role = url.searchParams.get("role") ?? undefined;
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const projectType = url.searchParams.get("projectType") ?? undefined;
    const memberId = member.role === "admin" ? (url.searchParams.get("memberId") ?? undefined) : member.id;

    const rows = listEffortReportRows(db, {
      month,
      memberId,
      departmentName,
      role,
      projectId,
      projectType,
    });

    const headers = [
      "日付",
      "メンバー",
      "部署",
      "権限",
      "案件コード",
      "案件名",
      "種別",
      "タスク",
      "時間",
      "備考",
    ];

    const csvRows = rows.map((row) => [
      row.workDate,
      row.memberName,
      row.departmentName ?? "",
      row.role,
      row.projectCode,
      row.projectName,
      row.projectType,
      row.taskName ?? "",
      String(row.allocatedHours),
      row.note ?? "",
    ]);

    const csv = [headers, ...csvRows].map((cells) => cells.map(escapeCsv).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kosu-effort-report-${month}.csv"`,
      },
    });
  } finally {
    sqlite.close();
  }
};

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const meta: Route.MetaFunction = () => [{ title: "工数実績レポート | kosu" }];

export default function Reports() {
  const data = useLoaderData<typeof loader>();

  const totalHours = data.rows.reduce((sum: number, row) => sum + row.allocatedHours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">工数実績レポート</h1>
          <p className="text-sm text-slate-600">案件・メンバー・月ごとの実績工数を確認してCSV出力できます。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthlyCloseStatusBadge status={data.closeStatus} />
          <Form method="post">
            <input name="month" type="hidden" value={data.month} />
            <Button type="submit" variant="outline">
              CSV エクスポート
            </Button>
          </Form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
            <div>
              <label className="text-sm font-medium text-slate-800">月</label>
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                defaultValue={data.month}
                name="month"
                type="month"
              />
            </div>
            {data.isAdmin ? (
              <div>
                <label className="text-sm font-medium text-slate-800">メンバー</label>
                <select
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  defaultValue={data.memberId}
                  name="memberId"
                >
                  <option value="">全員</option>
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {data.isAdmin ? (
              <div>
                <label className="text-sm font-medium text-slate-800">部署</label>
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  defaultValue={data.departmentName}
                  name="departmentName"
                  type="text"
                />
              </div>
            ) : null}
            {data.isAdmin ? (
              <div>
                <label className="text-sm font-medium text-slate-800">権限</label>
                <select
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  defaultValue={data.role}
                  name="role"
                >
                  <option value="">すべて</option>
                  <option value="admin">管理者</option>
                  <option value="member">メンバー</option>
                </select>
              </div>
            ) : null}
            <div>
              <label className="text-sm font-medium text-slate-800">案件</label>
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                defaultValue={data.projectId}
                name="projectId"
              >
                <option value="">すべて</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">種別</label>
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                defaultValue={data.projectType}
                name="projectType"
              >
                <option value="">すべて</option>
                <option value="billable">請求対応</option>
                <option value="internal">内部</option>
                <option value="non_billable">非請求</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" type="submit" variant="primary">
                適用
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>合計時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{totalHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>件数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.rows.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>明細</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <EmptyState description="条件に一致する工数データがありません。" title="データがありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">日付</th>
                    {data.isAdmin ? <th className="py-2 pr-4">メンバー</th> : null}
                    <th className="py-2 pr-4">案件</th>
                    <th className="py-2 pr-4">種別</th>
                    <th className="py-2 pr-4">タスク</th>
                    <th className="py-2 pr-4 text-right">時間</th>
                    <th className="py-2">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.allocationId} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{row.workDate}</td>
                      {data.isAdmin ? <td className="py-2 pr-4">{row.memberName}</td> : null}
                      <td className="py-2 pr-4">
                        <Link className="text-sky-700 hover:underline" to={`/projects/${row.projectId}`}>
                          {row.projectCode} {row.projectName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{row.projectType}</td>
                      <td className="py-2 pr-4">{row.taskName ?? "-"}</td>
                      <td className="py-2 pr-4 text-right">{row.allocatedHours}h</td>
                      <td className="py-2">{row.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
