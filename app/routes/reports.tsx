import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/reports";

import { MonthlyCloseStatusBadge } from "~/components/monthly-close-status";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { createDatabaseConnection } from "~/db/client";
import { listEffortReportRows } from "~/db/repositories/effort-allocations";
import {
  listMembers,
  withoutMemberFinancials,
} from "~/db/repositories/members";
import { listEffortReportProjects } from "~/db/repositories/projects";
import { neutralizeCsvCell } from "~/lib/csv";
import {
  effortReportSearch,
  parseEffortReportFilters,
} from "~/lib/effort-report-filters";
import { memberRoleLabels, projectTypeLabels } from "~/lib/master-labels";
import { getSessionMember } from "~/services/auth";
import { getMonthlyPeriodState } from "~/services/monthly-cost-close";
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
    const filters = parseEffortReportFilters(url, member, currentMonth);
    const { month, departmentName, role, projectId, projectType, memberId } =
      filters;

    const reportRows = listEffortReportRows(db, {
      month,
      memberId,
      departmentName,
      role,
      projectId,
      projectType,
    });
    const rows = reportRows.map((row) => ({
      ...row,
      hourlyCostRateSnapshot: null,
    }));

    const projects = listEffortReportProjects(
      db,
      member.role === "admin" ? undefined : member.id,
    );
    const members =
      member.role === "admin"
        ? listMembers(db).map(withoutMemberFinancials)
        : [];

    return {
      exportSearch: effortReportSearch(filters),
      closeStatus: getMonthlyPeriodState(db, month).status,
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
    const filters = parseEffortReportFilters(url, member, currentMonth);
    const { month, departmentName, role, projectId, projectType, memberId } =
      filters;

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

    const csv = [headers, ...csvRows]
      .map((cells) => cells.map(escapeCsv).join(","))
      .join("\n");

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
  const neutralized = neutralizeCsvCell(value);
  if (
    neutralized.includes(",") ||
    neutralized.includes('"') ||
    neutralized.includes("\n") ||
    neutralized.includes("\r")
  ) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export const meta: Route.MetaFunction = () => [
  { title: "工数実績レポート | kosu" },
];

export default function Reports() {
  const data = useLoaderData<typeof loader>();

  const totalHours = data.rows.reduce(
    (sum: number, row) => sum + row.allocatedHours,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            工数実績レポート
          </h1>
          <p className="text-sm text-slate-600">
            案件・メンバー・月ごとの実績工数を確認してCSV出力できます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthlyCloseStatusBadge
            month={data.month}
            status={data.closeStatus}
          />
          <Form
            method="post"
            action={`/reports/export?${data.exportSearch}`}
            reloadDocument
          >
            <Button type="submit" variant="outline">
              CSV エクスポート
            </Button>
          </Form>
        </div>
      </div>

      <div className="space-y-2 break-words rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          適用中：{data.month} ／ 案件：
          {data.projects.find((p) => p.id === data.projectId)?.name ??
            (data.projectId || "すべて")}
          {data.isAdmin
            ? ` ／ メンバー：${data.members.find((m) => m.id === data.memberId)?.displayName ?? (data.memberId || "全員")}`
            : " ／ 本人分"}
          {data.departmentName ? ` ／ 部署：${data.departmentName}` : ""}
          {data.role
            ? ` ／ 操作権限：${memberRoleLabels[data.role as keyof typeof memberRoleLabels] ?? data.role}`
            : ""}
          {data.projectType
            ? ` ／ 種別：${projectTypeLabels[data.projectType as keyof typeof projectTypeLabels] ?? data.projectType}`
            : ""}
        </p>
        <p>
          名称・部署・操作権限・案件種別は現在のマスタを参照します。工数確定済みでも、当時の所属や分類が固定されるわけではありません。
        </p>
        <p>
          CSVは適用済みの条件で出力します。未適用の変更は含みません。既存形式との互換性のため、権限・種別はコード（admin
          / member、billable / internal / non_billable）で出力します。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            key={data.exportSearch}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            method="get"
          >
            <div>
              <label
                htmlFor="report-month"
                className="text-sm font-medium text-slate-800"
              >
                月
              </label>
              <input
                id="report-month"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                defaultValue={data.month}
                name="month"
                type="month"
              />
            </div>
            {data.isAdmin ? (
              <div>
                <label
                  htmlFor="report-member"
                  className="text-sm font-medium text-slate-800"
                >
                  メンバー
                </label>
                <select
                  id="report-member"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  defaultValue={data.memberId}
                  name="memberId"
                >
                  <option value="">全員</option>
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                      {m.isActive ? "" : "（無効）"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {data.isAdmin ? (
              <div>
                <label
                  htmlFor="report-department"
                  className="text-sm font-medium text-slate-800"
                >
                  部署
                </label>
                <input
                  id="report-department"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  defaultValue={data.departmentName}
                  name="departmentName"
                  type="text"
                />
              </div>
            ) : null}
            {data.isAdmin ? (
              <div>
                <label
                  htmlFor="report-role"
                  className="text-sm font-medium text-slate-800"
                >
                  操作権限
                </label>
                <select
                  id="report-role"
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
              <label
                htmlFor="report-project"
                className="text-sm font-medium text-slate-800"
              >
                案件
              </label>
              <select
                id="report-project"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                defaultValue={data.projectId}
                name="projectId"
              >
                <option value="">すべて</option>
                {[false, true].map((archived) => (
                  <optgroup
                    key={String(archived)}
                    label={archived ? "終了（アーカイブ）" : "有効"}
                  >
                    {data.projects
                      .filter((p) => p.isArchived === archived)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} {p.name}
                          {archived ? " 終了（アーカイブ）" : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="report-type"
                className="text-sm font-medium text-slate-800"
              >
                種別
              </label>
              <select
                id="report-type"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                defaultValue={data.projectType}
                name="projectType"
              >
                <option value="">すべて</option>
                {Object.entries(projectTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
            <EmptyState
              description="条件に一致する工数データがありません。"
              title="データがありません"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">日付</th>
                    {data.isAdmin ? (
                      <th className="py-2 pr-4">メンバー</th>
                    ) : null}
                    <th className="py-2 pr-4">案件</th>
                    <th className="py-2 pr-4">種別</th>
                    <th className="py-2 pr-4">タスク</th>
                    <th className="py-2 pr-4 text-right">時間</th>
                    <th className="py-2">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={row.allocationId}
                      className="border-b border-slate-100"
                    >
                      <td className="whitespace-nowrap py-2 pr-4">
                        {row.workDate}
                      </td>
                      {data.isAdmin ? (
                        <td className="py-2 pr-4">
                          {row.memberName}
                          {row.memberIsActive ? "" : "（無効）"}
                        </td>
                      ) : null}
                      <td className="py-2 pr-4">
                        {data.isAdmin ? (
                          <Link
                            className="text-sky-700 hover:underline"
                            to={`/projects/${row.projectId}`}
                          >
                            {row.projectCode} {row.projectName}
                          </Link>
                        ) : (
                          <span>
                            {row.projectCode} {row.projectName}
                          </span>
                        )}
                        {row.projectIsArchived ? " 終了（アーカイブ）" : ""}
                      </td>
                      <td className="py-2 pr-4">
                        {projectTypeLabels[row.projectType]}
                      </td>
                      <td className="py-2 pr-4">{row.taskName ?? "-"}</td>
                      <td className="py-2 pr-4 text-right">
                        {row.allocatedHours}h
                      </td>
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
