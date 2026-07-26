import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/period-locks";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import {
  listMonthlyCostCloseEvents,
  listMonthlyCostCloses,
} from "~/db/repositories/monthly-cost-closes";
import { listMembers } from "~/db/repositories/members";
import { isValidMonth } from "~/lib/time";
import { requireAdministrator } from "~/services/auth";
import { approveMonthlyCostClose } from "~/services/monthly-cost-approval";
import { getMonthlyCostCompleteness } from "~/services/monthly-cost-completeness";
import {
  correctMissingHourlyCostSnapshot,
  getMonthlyCostCloseState,
  reopenMonthlyCostClose,
  startMonthlyCostReview,
} from "~/services/monthly-cost-close";
import { listProjectFinancialReview } from "~/services/project-financials";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const url = new URL(request.url);
    const { currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const month = requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const state = getMonthlyCostCloseState(db, month);
    const completeness = state.status === "approved"
      ? { blockers: [], warnings: [] }
      : getMonthlyCostCompleteness(db, month);
    const members = new Map(listMembers(db).map((member) => [member.id, member.displayName]));

    return {
      month,
      state,
      completeness,
      projectRows: listProjectFinancialReview(db, { month }),
      history: state.close
        ? listMonthlyCostCloseEvents(db, state.close.id).map((event) => ({
            ...event,
            actorName: event.actorMemberId ? members.get(event.actorMemberId) ?? event.actorMemberId : "システム",
          }))
        : [],
      recentCloses: listMonthlyCostCloses(db).slice(0, 12),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = requireAdministrator(db, request);
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "");
    const month = String(formData.get("month") ?? "");

    if (!isValidMonth(month)) {
      return { error: "対象月は YYYY-MM 形式で指定してください。" };
    }

    if (intent === "startReview") {
      startMonthlyCostReview(db, { month, actorMemberId: member.id });
      return { success: `${month} のレビューを開始しました。` };
    }

    if (intent === "approve") {
      const result = approveMonthlyCostClose(db, { month, actorMemberId: member.id });
      return { success: `${month} を承認しました（案件スナップショット ${result.projectSnapshotCount} 件）。` };
    }

    if (intent === "reopen") {
      reopenMonthlyCostClose(db, {
        month,
        actorMemberId: member.id,
        reason: String(formData.get("reason") ?? ""),
      });
      return { success: `${month} を再オープンしました。` };
    }

    if (intent === "correctCost") {
      correctMissingHourlyCostSnapshot(db, {
        month,
        actorMemberId: member.id,
        targetType: String(formData.get("targetType") ?? "") as "monthly_plan" | "effort_allocation",
        targetId: String(formData.get("targetId") ?? ""),
        hourlyCostRate: Number(formData.get("hourlyCostRate") ?? Number.NaN),
        reason: String(formData.get("reason") ?? ""),
      });
      return { success: "原価スナップショットを補正し、履歴に記録しました。" };
    }

    return { error: "不明な操作です。" };
  } catch (error) {
    if (error instanceof Response) throw error;
    return { error: error instanceof Error ? error.message : "月次締めの操作に失敗しました。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "月次原価締め | kosu" }];

export default function MonthlyCostClose({ actionData }: Route.ComponentProps) {
  const { month, state, completeness, projectRows, history, recentCloses } = useLoaderData<typeof loader>();
  const tone = state.status === "open" ? "success" : state.status === "in_review" ? "warning" : "neutral";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">月次原価締め</h1>
          <p className="text-sm text-slate-600">
            工数配賦と直接人件費を確認し、承認時点の案件財務を固定します。外注費、経費、間接費は対象外です。
          </p>
        </div>
        <Badge tone={tone}>{month} · {state.label}</Badge>
      </div>

      {actionData?.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{actionData.error}</p>
      ) : null}
      {actionData?.success ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{actionData.success}</p>
      ) : null}

      <Card>
        <CardHeader><CardTitle>対象月と状態</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
            <div>
              <label className="text-sm font-medium text-slate-800" htmlFor="monthly-close-month">対象月</label>
              <Input className="mt-1" defaultValue={month} id="monthly-close-month" name="month" type="month" />
            </div>
            <Button type="submit" variant="outline">表示</Button>
          </Form>

          {state.status === "open" ? (
            <Form method="post">
              <input name="month" type="hidden" value={month} />
              <Button name="intent" type="submit" value="startReview" variant="primary">レビューを開始して保護</Button>
            </Form>
          ) : (
            <div className="space-y-3">
              {state.status === "in_review" ? (
                <Form method="post">
                  <input name="month" type="hidden" value={month} />
                  <Button
                    disabled={completeness.blockers.length > 0}
                    name="intent"
                    type="submit"
                    value="approve"
                    variant="primary"
                  >
                    完全性を再確認して承認
                  </Button>
                </Form>
              ) : (
                <p className="text-sm text-slate-700">表示値は承認時のスナップショットです。現在の案件・単価変更の影響を受けません。</p>
              )}
              <Form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="post">
                <input name="month" type="hidden" value={month} />
                <div className="min-w-72 flex-1">
                  <label className="text-sm font-medium text-slate-800" htmlFor="monthly-close-reopen-reason">再オープン理由（必須）</label>
                  <Input className="mt-1" id="monthly-close-reopen-reason" name="reason" required />
                </div>
                <Button name="intent" type="submit" value="reopen" variant="outline">再オープン</Button>
              </Form>
            </div>
          )}
        </CardContent>
      </Card>

      <IssueSection
        issues={completeness.blockers}
        month={month}
        state={state.status}
        title={`承認ブロッカー（${completeness.blockers.length}件）`}
      />
      <IssueSection
        issues={completeness.warnings}
        month={month}
        state={state.status}
        title={`確認警告（${completeness.warnings.length}件）`}
      />

      <Card>
        <CardHeader><CardTitle>{state.status === "approved" ? "承認済み案件財務" : "現在の案件財務"}</CardTitle></CardHeader>
        <CardContent>
          {projectRows.length === 0 ? (
            <p className="text-sm text-slate-600">活動または財務基準のある案件はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">案件</th>
                    <th className="py-2 pr-4 text-right">当月予定原価</th>
                    <th className="py-2 pr-4 text-right">当月実績原価</th>
                    <th className="py-2 pr-4 text-right">月末累計原価</th>
                    <th className="py-2 text-right">残予算</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map((row) => (
                    <tr className="border-b border-slate-100" key={row.project.id}>
                      <td className="py-2 pr-4 font-medium">{row.project.code} {row.project.name}</td>
                      <td className="py-2 pr-4 text-right">{formatYen(row.monthlyPlanned.knownCost)}</td>
                      <td className="py-2 pr-4 text-right">{formatYen(row.monthlyActual.knownCost)}</td>
                      <td className="py-2 pr-4 text-right">{formatYen(row.cumulativeActual.knownCost)}</td>
                      <td className="py-2 text-right">{row.remainingLaborCostBudget === null ? "-" : formatYen(row.remainingLaborCostBudget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>操作履歴</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-600">履歴はまだありません。</p>
          ) : (
            <ol className="space-y-3">
              {history.map((event) => (
                <li className="rounded-xl border border-slate-200 p-3 text-sm" key={event.id}>
                  <p className="font-medium text-slate-900">{eventLabel(event.eventType)} · {event.actorName}</p>
                  <p className="text-slate-600">{event.occurredAt}{event.reason ? ` · ${event.reason}` : ""}</p>
                  {event.nextHourlyCostRate !== null ? (
                    <p className="text-slate-600">補正単価: {formatYen(event.nextHourlyCostRate)}/h</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {recentCloses.length > 0 ? (
        <p className="text-sm text-slate-600">
          最近の締め: {recentCloses.map((close) => (
            <Link className="mr-3 font-medium text-indigo-700 hover:underline" key={close.id} to={`/period-locks?month=${close.month}`}>
              {close.month}
            </Link>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function IssueSection({
  issues,
  month,
  state,
  title,
}: {
  issues: Awaited<ReturnType<typeof loader>>["completeness"]["blockers"];
  month: string;
  state: "open" | "in_review" | "approved";
  title: string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-600">該当項目はありません。</p>
        ) : (
          <ul className="space-y-4">
            {issues.map((issue) => (
              <li className="rounded-xl border border-amber-200 bg-amber-50/60 p-4" key={issue.key}>
                <p className="font-semibold text-slate-900">{issue.title}</p>
                <p className="mt-1 text-sm text-slate-700">{issue.detail}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">{issue.code}</p>
                <Link className="mt-2 inline-block text-sm font-semibold text-indigo-700 hover:underline" to={issue.href}>修正先を開く</Link>
                {state === "open" && issue.correction ? (
                  <Form className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]" method="post">
                    <input name="month" type="hidden" value={month} />
                    <input name="targetType" type="hidden" value={issue.correction.targetType} />
                    <input name="targetId" type="hidden" value={issue.correction.targetId} />
                    <Input min="0" name="hourlyCostRate" placeholder="円/h" required step="1" type="number" />
                    <Input name="reason" placeholder="補正理由" required />
                    <Button name="intent" type="submit" value="correctCost" variant="outline">原価を補正</Button>
                  </Form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatYen(value: number) {
  return `${value.toLocaleString()}円`;
}

function eventLabel(eventType: string) {
  return {
    migration: "旧ロック移行",
    entered_review: "レビュー開始",
    approved: "承認",
    reopened: "再オープン",
    cost_snapshot_corrected: "原価補正",
  }[eventType] ?? eventType;
}
