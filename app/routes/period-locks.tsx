import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/period-locks";

import { MonthlyCloseStatusBadge } from "~/components/monthly-close-status";
import { getMonthlyEffortCompleteness } from "~/services/monthly-effort-completeness";
import {
  startMonthlyEffortReview,
  confirmMonthlyEffortClose,
} from "~/services/monthly-effort-close";
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
import { logInfo, logRouteError } from "~/lib/log";
import { isValidMonth } from "~/lib/time";
import { requireAdministrator } from "~/services/auth";
import { approveMonthlyCostClose } from "~/services/monthly-cost-approval";
import { getMonthlyCostCompleteness } from "~/services/monthly-cost-completeness";
import {
  correctMissingHourlyCostSnapshot,
  getMonthlyCostCloseState,
  getMonthlyPeriodState,
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
    const month =
      requestedMonth && isValidMonth(requestedMonth)
        ? requestedMonth
        : currentMonth;
    const state = getMonthlyCostCloseState(db, month);
    const completeness =
      state.status === "approved"
        ? { blockers: [], warnings: [] }
        : getMonthlyCostCompleteness(db, month);
    const members = new Map(
      listMembers(db).map((member) => [member.id, member.displayName]),
    );

    return {
      month,
      state,
      completeness,
      periodState: getMonthlyPeriodState(db, month),
      effortCompleteness: getMonthlyEffortCompleteness(db, month),
      effortReviewer: state.close?.effortReviewedByMemberId
        ? members.get(state.close.effortReviewedByMemberId)
        : null,
      effortConfirmer: state.close?.effortConfirmedByMemberId
        ? members.get(state.close.effortConfirmedByMemberId)
        : null,
      costReviewer: state.close?.enteredReviewByMemberId
        ? members.get(state.close.enteredReviewByMemberId)
        : null,
      costApprover: state.close?.approvedByMemberId
        ? members.get(state.close.approvedByMemberId)
        : null,
      projectRows: listProjectFinancialReview(db, { month }),
      history: state.close
        ? listMonthlyCostCloseEvents(db, state.close.id).map((event) => ({
            ...event,
            actorName: event.actorMemberId
              ? (members.get(event.actorMemberId) ?? event.actorMemberId)
              : "システム",
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

    if (intent === "startEffortReview") {
      startMonthlyEffortReview(db, { month, actorMemberId: member.id });
      logInfo("monthly_close.effort_reviewed", "工数レビューを開始しました", {
        month,
        actorMemberId: member.id,
      });
      return { success: `${month} の工数レビューを開始しました。` };
    }
    if (intent === "confirmEffort") {
      confirmMonthlyEffortClose(db, { month, actorMemberId: member.id });
      logInfo("monthly_close.effort_confirmed", "工数を確定しました", {
        month,
        actorMemberId: member.id,
      });
      return {
        success: `${month} の工数を確定しました。時間管理はこれで完了です。`,
      };
    }
    if (intent === "startReview") {
      startMonthlyCostReview(db, { month, actorMemberId: member.id });
      logInfo(
        "monthly_close.entered_review",
        "月次締めのレビューを開始しました",
        { month, actorMemberId: member.id },
      );
      return { success: `${month} のレビューを開始しました。` };
    }

    if (intent === "approve") {
      const result = approveMonthlyCostClose(db, {
        month,
        actorMemberId: member.id,
      });
      logInfo("monthly_close.approved", "月次締めを承認しました", {
        month,
        actorMemberId: member.id,
        projectSnapshotCount: result.projectSnapshotCount,
      });
      return {
        success: `${month} を承認しました（案件スナップショット ${result.projectSnapshotCount} 件）。`,
      };
    }

    if (intent === "reopen") {
      reopenMonthlyCostClose(db, {
        month,
        actorMemberId: member.id,
        reason: String(formData.get("reason") ?? ""),
      });
      logInfo("monthly_close.reopened", "月次締めを再オープンしました", {
        month,
        actorMemberId: member.id,
      });
      return { success: `${month} を再オープンしました。` };
    }

    if (intent === "correctCost") {
      correctMissingHourlyCostSnapshot(db, {
        month,
        actorMemberId: member.id,
        targetType: String(formData.get("targetType") ?? "") as
          "monthly_plan" | "effort_allocation",
        targetId: String(formData.get("targetId") ?? ""),
        hourlyCostRate:
          String(formData.get("hourlyCostRate") ?? "").trim() === ""
            ? NaN
            : Number(formData.get("hourlyCostRate")),
        reason: String(formData.get("reason") ?? ""),
      });
      logInfo(
        "monthly_close.cost_snapshot_corrected",
        "原価スナップショットを補正しました",
        {
          month,
          actorMemberId: member.id,
          targetType: String(formData.get("targetType") ?? ""),
        },
      );
      return { success: "原価スナップショットを補正し、履歴に記録しました。" };
    }

    return { error: "不明な操作です。" };
  } catch (error) {
    if (error instanceof Response) throw error;
    logRouteError("period-locks", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "月次締めの操作に失敗しました。",
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "月次締め | kosu" }];

export default function MonthlyCostClose({ actionData }: Route.ComponentProps) {
  const {
    month,
    state,
    periodState,
    effortCompleteness,
    effortReviewer,
    effortConfirmer,
    costReviewer,
    costApprover,
    completeness,
    projectRows,
    history,
    recentCloses,
  } = useLoaderData<typeof loader>();
  const tone =
    state.status === "open"
      ? "success"
      : state.status === "in_review"
        ? "warning"
        : "neutral";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            月次締め
          </h1>
          <p className="text-sm text-slate-600">
            提出と時間の配賦を確認して工数を確定します。原価の確認は、金額も管理する場合だけ行います。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MonthlyCloseStatusBadge
            month={month}
            status={periodState.effortStatus}
          />
          <Badge tone={tone}>{state.label}</Badge>
        </div>
      </div>

      {actionData?.error ? (
        <p
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {actionData.error}
        </p>
      ) : null}
      {actionData?.success ? (
        <p
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
          role="status"
        >
          {actionData.success}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>対象月と状態</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            method="get"
          >
            <div>
              <label
                className="text-sm font-medium text-slate-800"
                htmlFor="monthly-close-month"
              >
                対象月
              </label>
              <Input
                className="mt-1"
                defaultValue={month}
                id="monthly-close-month"
                name="month"
                type="month"
              />
            </div>
            <Button type="submit" variant="outline">
              表示
            </Button>
          </Form>

          <h2 className="text-lg font-semibold">工数の確認・確定</h2>
          {periodState.effortStatus === "open" ? (
            <Form method="post">
              <input name="month" type="hidden" value={month} />
              <Button
                disabled={
                  effortCompleteness.blockers.length > 0 ||
                  state.status !== "open"
                }
                name="intent"
                type="submit"
                value="startEffortReview"
                variant="primary"
              >
                工数レビューを開始
              </Button>
            </Form>
          ) : periodState.effortStatus === "in_review" ? (
            <Form method="post">
              <input name="month" type="hidden" value={month} />
              <Button
                disabled={effortCompleteness.blockers.length > 0}
                name="intent"
                type="submit"
                value="confirmEffort"
                variant="primary"
              >
                工数を確定
              </Button>
            </Form>
          ) : (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              工数確定済みです。時間管理はこれで完了です。原価を管理しない場合、追加の操作は不要です。
            </p>
          )}
          {periodState.close?.effortReviewedAt ? (
            <p className="text-sm text-slate-600">
              工数レビュー: {effortReviewer ?? "不明"} ·{" "}
              {periodState.close.effortReviewedAt}
            </p>
          ) : null}
          {periodState.close?.effortConfirmedAt ? (
            <p className="text-sm text-slate-600">
              工数確定: {effortConfirmer ?? "不明"} ·{" "}
              {periodState.close.effortConfirmedAt}
            </p>
          ) : null}
          <p className="text-sm text-slate-600">
            レビュー中・確定後は時間と予定の編集が保護されます。予定確認・単価・金額は工数確定の必須条件ではありません。
          </p>
        </CardContent>
      </Card>
      <IssueSection
        issues={effortCompleteness.blockers}
        month={month}
        state={state.status}
        title={`工数の確認事項（${effortCompleteness.blockers.length}件）`}
      />

      <details className="space-y-4 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">
          任意: 原価の確認・承認 — {state.label}
        </summary>
        <p className="text-sm text-slate-600">
          直接人件費のみを扱います。外注費、経費、間接費は対象外です。工数確定だけでは金額は承認されません。
        </p>
        {periodState.effortStatus !== "confirmed" ? (
          <p className="text-sm text-slate-600">
            原価レビュー・承認の前に工数を確定してください。
          </p>
        ) : null}
        {state.status === "approved" ? (
          <p className="text-sm text-slate-700">
            表示値は原価承認時のスナップショットです。現在の案件・単価変更の影響を受けません。
          </p>
        ) : (
          <Form method="post">
            <input name="month" type="hidden" value={month} />
            <Button
              disabled={
                periodState.effortStatus !== "confirmed" ||
                completeness.blockers.length > 0
              }
              name="intent"
              type="submit"
              value={state.status === "open" ? "startReview" : "approve"}
              variant="primary"
            >
              {state.status === "open" ? "原価レビューを開始" : "原価を承認"}
            </Button>
          </Form>
        )}
        {state.close?.enteredReviewAt ? (
          <p className="text-sm text-slate-600">
            原価レビュー: {costReviewer ?? "不明"} ·{" "}
            {state.close.enteredReviewAt}
          </p>
        ) : null}
        {state.close?.approvedAt ? (
          <p className="text-sm text-slate-600">
            原価承認: {costApprover ?? "不明"} · {state.close.approvedAt}
          </p>
        ) : null}
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
          <CardHeader>
            <CardTitle>
              {state.status === "approved"
                ? "承認済み案件財務"
                : "現在の案件財務"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectRows.length === 0 ? (
              <p className="text-sm text-slate-600">
                活動または財務基準のある案件はありません。
              </p>
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
                      <tr
                        className="border-b border-slate-100"
                        key={row.project.id}
                      >
                        <td className="py-2 pr-4 font-medium">
                          {row.project.code} {row.project.name}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatYen(row.monthlyPlanned.knownCost)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatYen(row.monthlyActual.knownCost)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatYen(row.cumulativeActual.knownCost)}
                        </td>
                        <td className="py-2 text-right">
                          {row.remainingLaborCostBudget === null
                            ? "-"
                            : formatYen(row.remainingLaborCostBudget)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </details>
      {periodState.isProtected ? (
        <Card>
          <CardHeader>
            <CardTitle>修正が必要な場合</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-600">
              再オープンすると工数・原価の両方が未締めに戻ります。提出済みの工数は、実績を変更するまで提出済みのままです。
            </p>
            <Form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              method="post"
            >
              <input name="month" type="hidden" value={month} />
              <div className="min-w-0 flex-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="monthly-close-reopen-reason"
                >
                  再オープン理由（必須）
                </label>
                <Input
                  className="mt-1"
                  id="monthly-close-reopen-reason"
                  name="reason"
                  required
                />
              </div>
              <Button
                name="intent"
                type="submit"
                value="reopen"
                variant="outline"
              >
                再オープン
              </Button>
            </Form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>操作履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-600">履歴はまだありません。</p>
          ) : (
            <ol className="space-y-3">
              {history.map((event) => (
                <li
                  className="rounded-xl border border-slate-200 p-3 text-sm"
                  key={event.id}
                >
                  <p className="font-medium text-slate-900">
                    {eventLabel(event.eventType)} · {event.actorName}
                  </p>
                  <p className="text-slate-600">
                    {event.occurredAt}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                  {event.nextHourlyCostRate !== null ? (
                    <p className="text-slate-600">
                      補正単価: {formatYen(event.nextHourlyCostRate)}/h
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {recentCloses.length > 0 ? (
        <p className="text-sm text-slate-600">
          最近の締め:{" "}
          {recentCloses.map((close) => (
            <Link
              className="mr-3 font-medium text-indigo-700 hover:underline"
              key={close.id}
              to={`/period-locks?month=${close.month}`}
            >
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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-600">該当項目はありません。</p>
        ) : (
          <ul className="space-y-4">
            {issues.map((issue) => (
              <li
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"
                key={issue.key}
              >
                <p className="font-semibold text-slate-900">{issue.title}</p>
                <p className="mt-1 text-sm text-slate-700">{issue.detail}</p>
                <Link
                  className="mt-2 inline-block text-sm font-semibold text-indigo-700 hover:underline"
                  to={issue.href}
                >
                  修正先を開く
                </Link>
                {state === "open" && issue.correction ? (
                  <Form
                    className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
                    method="post"
                  >
                    <input name="month" type="hidden" value={month} />
                    <input
                      name="targetType"
                      type="hidden"
                      value={issue.correction.targetType}
                    />
                    <input
                      name="targetId"
                      type="hidden"
                      value={issue.correction.targetId}
                    />
                    <Input
                      aria-label="補正する時間単価（円/h）"
                      min="0"
                      name="hourlyCostRate"
                      placeholder="円/h"
                      required
                      step="1"
                      type="number"
                    />
                    <Input
                      aria-label="原価の補正理由"
                      name="reason"
                      placeholder="補正理由"
                      required
                    />
                    <Button
                      name="intent"
                      type="submit"
                      value="correctCost"
                      variant="outline"
                    >
                      原価を補正
                    </Button>
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
  return (
    {
      migration: "旧ロック移行",
      effort_migration: "工数状態の移行",
      effort_reviewed: "工数レビュー開始",
      effort_confirmed: "工数確定",
      entered_review: "原価レビュー開始",
      approved: "原価承認",
      reopened: "再オープン",
      cost_snapshot_corrected: "原価補正",
    }[eventType] ?? eventType
  );
}
