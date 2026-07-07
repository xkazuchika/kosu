import { Form, Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/work-logs";

import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { listDailyWorkLogsByMember } from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { findMemberById, listMembers } from "~/db/repositories/members";
import { getSessionMember } from "~/services/auth";

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

    const date = url.searchParams.get("date");

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const memberQuery = member.role === "admin" && targetMemberId !== member.id ? `?memberId=${targetMemberId}` : "";
      throw redirect(`/work-logs/${date}${memberQuery}`);
    }

    const logs = listDailyWorkLogsByMember(db, targetMemberId);

    return {
      currentMemberId: member.id,
      isAdmin: member.role === "admin",
      members: member.role === "admin" ? listMembers(db) : [],
      targetMember,
      today: new Date().toISOString().slice(0, 10),
      logs: logs.map((log) => {
        const allocations = listAllocationsByWorkLog(db, log.id);
        const allocatedTotal = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
        const variance = log.totalWorkingHours - allocatedTotal;

        return { ...log, allocatedTotal, variance };
      }),
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "工数入力 | kosu" }];

export default function WorkLogs() {
  const { currentMemberId, isAdmin, logs, members, targetMember, today } = useLoaderData<typeof loader>();
  const memberQuery = isAdmin && targetMember.id !== currentMemberId ? `?memberId=${targetMember.id}` : "";
  const monthlyMemberQuery = isAdmin && targetMember.id !== currentMemberId ? `&memberId=${targetMember.id}` : "";
  const currentMonth = today.slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">日次工数</h1>
          <p className="text-sm text-slate-600">対象: {targetMember.displayName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            to={`/work-logs/month?month=${currentMonth}${monthlyMemberQuery}`}
          >
            月次一括入力
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
            to={`/work-logs/${today}${memberQuery}`}
          >
            今日の工数を入力
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
          <label className="text-sm font-medium text-slate-800">日付を指定</label>
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            defaultValue={today}
            name="date"
            type="date"
            required
          />
        </div>
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" type="submit">
          開く
        </button>
      </Form>
      <DataTable
        columns={["日付", "総稼働時間", "配賦合計", "差分", "状態"]}
        emptyMessage="日次工数がまだ登録されていません。"
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
            <Badge tone="warning">未配分</Badge>
          ),
        ])}
      />
    </div>
  );
}
