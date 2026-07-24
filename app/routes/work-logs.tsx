import { Form, Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/work-logs";

import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { listDailyWorkLogsByMemberAndMonth } from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { findMemberById, listMembers, withoutMemberFinancials } from "~/db/repositories/members";
import { isValidMonth } from "~/lib/time";
import { getSessionMember } from "~/services/auth";
import { getWorkspaceCalendarContext } from "~/services/workspace-calendar";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const requestedMemberId = url.searchParams.get("memberId");
    const targetMemberId = member.role === "admin" && requestedMemberId ? requestedMemberId : member.id;
    const targetMember = findMemberById(db, targetMemberId);

    if (!targetMember) {
      throw new Response("Not found", { status: 404 });
    }

    const { today, currentMonth } = getWorkspaceCalendarContext(db);
    const requestedMonth = url.searchParams.get("month");
    const month = requestedMonth && isValidMonth(requestedMonth) ? requestedMonth : currentMonth;
    const status = url.searchParams.get("status") === "unbalanced" ? "unbalanced" : "all";
    const date = url.searchParams.get("date");

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const memberQuery = member.role === "admin" && targetMemberId !== member.id ? `?memberId=${targetMemberId}` : "";
      throw redirect(`/work-logs/${date}${memberQuery}`);
    }

    const logs = listDailyWorkLogsByMemberAndMonth(db, targetMemberId, month)
      .map((log) => {
        const allocations = listAllocationsByWorkLog(db, log.id);
        const allocatedTotal = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
        const variance = log.totalWorkingHours - allocatedTotal;

        return { ...log, allocatedTotal, variance };
      })
      .filter((log) => status !== "unbalanced" || log.variance !== 0);

    return {
      currentMemberId: member.id,
      isAdmin: member.role === "admin",
      members: member.role === "admin" ? listMembers(db).map(withoutMemberFinancials) : [],
      targetMember: withoutMemberFinancials(targetMember),
      today,
      month,
      status,
      logs,
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "日別工数実績入力 | kosu" }];

export default function WorkLogs() {
  const { currentMemberId, isAdmin, logs, members, month, status, targetMember, today } = useLoaderData<typeof loader>();
  const memberQuery = isAdmin && targetMember.id !== currentMemberId ? `?memberId=${targetMember.id}` : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">日別工数実績入力</h1>
          <p className="text-sm text-slate-600">対象: {targetMember.displayName} · 日別の総稼働時間と案件別実績工数を入力します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
            to={`/work-logs/${today}${memberQuery}`}
          >
            今日の実績工数を入力
          </Link>
        </div>
      </div>
      <Form className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end" method="get">
        {isAdmin ? (
          <div>
            <label className="text-sm font-medium text-slate-800">対象メンバー</label>
            <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={targetMember.id} name="memberId">
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="text-sm font-medium text-slate-800">対象月</label>
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            defaultValue={month}
            name="month"
            type="month"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-800">状態</label>
          <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={status} name="status">
            <option value="all">すべて</option>
            <option value="unbalanced">未割当・超過のみ</option>
          </select>
        </div>
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" type="submit">
          表示
        </button>
      </Form>
      <Form className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end" method="get">
        {isAdmin && targetMember.id !== currentMemberId ? <input name="memberId" type="hidden" value={targetMember.id} /> : null}
        <div>
          <label className="text-sm font-medium text-slate-800">実績工数を入力する日付</label>
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            defaultValue={today}
            name="date"
            type="date"
            required
          />
        </div>
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" type="submit">
          この日の実績工数を開く
        </button>
      </Form>
        <DataTable
          columns={["日付", "総稼働時間", "案件別実績工数", "差分", "状態"]}
          emptyMessage={status === "unbalanced" ? "選択した月に未割当・超過の日はありません。" : "選択した月の日別実績工数はまだ登録されていません。"}
        rows={logs.map((log) => [
          <Link className="text-sky-700 hover:underline" key={log.id} to={`/work-logs/${log.workDate}${memberQuery}`}>
            {log.workDate}
          </Link>,
          `${log.totalWorkingHours}h`,
          `${log.allocatedTotal}h`,
          `${log.variance >= 0 ? "+" : ""}${log.variance}h`,
          log.variance === 0 ? (
            <Badge tone="success">完了</Badge>
          ) : (
            <Badge tone="warning">未割当</Badge>
          ),
        ])}
      />
    </div>
  );
}
