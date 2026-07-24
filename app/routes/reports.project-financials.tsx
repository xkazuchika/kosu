import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/reports.project-financials";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { listProjects } from "~/db/repositories/projects";
import { isValidMonth } from "~/lib/time";
import { requireAdministrator } from "~/services/auth";
import { listProjectFinancialReview, type ProjectFinancialReviewRow } from "~/services/project-financials";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

function formatYen(value: number) {
  return `${value.toLocaleString()}円`;
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const url = new URL(request.url);
    const { currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const month = requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const requestedProjectId = url.searchParams.get("projectId") ?? "";
    const projects = listProjects(db);
    const projectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId : "";

    return {
      month,
      projectId,
      projects,
      rows: listProjectFinancialReview(db, { month, projectId: projectId || undefined }),
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "案件財務レビュー | kosu" }];

export default function ProjectFinancialReview() {
  const { month, projectId, projects, rows } = useLoaderData<typeof loader>();
  const activeRows = rows.filter((row) => !row.project.isArchived);
  const archivedRows = rows.filter((row) => row.project.isArchived);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">案件財務レビュー</h1>
        <p className="text-sm text-slate-600">税抜の契約売上と直接人件費だけを確認します。仕入れ、外注費、経費、税金は含みません。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>対象</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="get">
            <div>
              <label className="text-sm font-medium text-slate-800">月</label>
              <Input className="mt-1" defaultValue={month} name="month" type="month" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">案件</label>
              <select className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={projectId} name="projectId">
                <option value="">すべての案件</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.code} {project.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary">表示</Button>
          </Form>
        </CardContent>
      </Card>

      <ProjectSection month={month} rows={activeRows} title="進行中の案件" />
      {archivedRows.length > 0 ? <ProjectSection month={month} rows={archivedRows} title="完了・アーカイブ済み案件" /> : null}
    </div>
  );
}

function ProjectSection({ month, rows, title }: { month: string; rows: ProjectFinancialReviewRow[]; title: string }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="text-sm text-slate-600">原価未設定の工数がある場合、残予算と確定労務粗利は参考値として扱いません。</p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">該当する案件はありません。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((row) => {
            const incomplete = row.monthlyPlanned.missingCostRows > 0 || row.monthlyActual.missingCostRows > 0 || row.cumulativeActual.missingCostRows > 0;
            const isRevenueProject = row.project.projectType === "billable" && row.contractRevenueAmount !== null;

            return (
              <Card key={row.project.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{row.project.code} {row.project.name}</CardTitle>
                      <p className="mt-1 text-sm text-slate-600">{row.project.projectType}</p>
                    </div>
                    <div className="flex gap-2">
                      {row.project.isArchived ? <Badge tone="neutral">完了</Badge> : <Badge tone="success">進行中</Badge>}
                      {incomplete ? <Badge tone="warning">原価未設定あり</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label={`${month} 予定人件費`} value={formatYen(row.monthlyPlanned.knownCost)} />
                    <Metric label={`${month} 実績人件費`} value={formatYen(row.monthlyActual.knownCost)} />
                    <Metric label="累計実績人件費" value={formatYen(row.cumulativeActual.knownCost)} />
                    <Metric label="人件費予算" value={row.laborCostBudgetAmount === null ? "未設定" : formatYen(row.laborCostBudgetAmount)} />
                  </div>

                  {row.monthlyPlanned.missingCostRows > 0 || row.monthlyActual.missingCostRows > 0 || row.cumulativeActual.missingCostRows > 0 ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      原価未設定: 予定 {row.monthlyPlanned.missingCostHours}h / {row.monthlyPlanned.missingCostRows}件、当月実績 {row.monthlyActual.missingCostHours}h / {row.monthlyActual.missingCostRows}件、累計実績 {row.cumulativeActual.missingCostHours}h / {row.cumulativeActual.missingCostRows}件
                    </p>
                  ) : null}

                  {row.project.isArchived ? (
                    isRevenueProject ? (
                      <FinancialMetric label="確定労務粗利" rate={row.finalLaborGrossProfitRate} value={row.finalLaborGrossProfit} />
                    ) : (
                      <p className="text-sm text-slate-600">契約売上が未設定のため、労務粗利は表示しません。</p>
                    )
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FinancialMetric label="残り人件費予算" rate={row.laborBudgetConsumption} rateLabel="予算消化" value={row.remainingLaborCostBudget} />
                      {isRevenueProject ? <FinancialMetric label="目標労務粗利" rate={row.targetLaborGrossProfitRate} value={row.targetLaborGrossProfit} /> : null}
                    </div>
                  )}

                  {row.legacyRevenueOrBudgetAmount !== null && row.contractRevenueAmount === null && row.laborCostBudgetAmount === null ? (
                    <p className="text-sm text-amber-800">旧「売上または予算」 {formatYen(row.legacyRevenueOrBudgetAmount)} は未分類です。案件編集で契約売上または人件費予算を設定してください。</p>
                  ) : null}

                  <div className="flex flex-wrap gap-3 text-sm font-semibold">
                    <Link className="text-indigo-700 hover:underline" to={`/projects/${row.project.id}`}>案件を編集</Link>
                    <Link className="text-indigo-700 hover:underline" to={`/monthly-plans/admin?month=${month}`}>月次予定工数を確認</Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FinancialMetric({ label, rate, rateLabel = "率", value }: { label: string; rate: number | null; rateLabel?: string; value: number | null }) {
  if (value === null) {
    return <Metric label={label} value="原価未設定あり / 未設定" />;
  }

  return <Metric label={`${label}${rate === null ? "" : `（${rateLabel} ${formatRate(rate)}）`}`} value={formatYen(value)} />;
}
