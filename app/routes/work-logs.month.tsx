import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createDatabaseConnection } from "~/db/client";
import {
  createDailyWorkLog,
  findDailyWorkLogByMemberAndDate,
  listDailyWorkLogsByMemberAndMonth,
  updateDailyWorkLog,
} from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { findMemberById, listMembers, withoutMemberFinancials } from "~/db/repositories/members";
import { getWeekdayLabel, isSaturdayDate, isSundayDate, isValidMonth, isValidQuarterHour, isWeekendDate, listMonthDates } from "~/lib/time";
import { getSessionMember } from "~/services/auth";
import { isMonthLocked } from "~/services/period-lock";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const requestedMonth = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const month = isValidMonth(requestedMonth) ? requestedMonth : new Date().toISOString().slice(0, 7);
    const requestedMemberId = url.searchParams.get("memberId");
    const isAdmin = currentMember.role === "admin";
    const targetMemberId = isAdmin && requestedMemberId ? requestedMemberId : currentMember.id;
    const targetMember = findMemberById(db, targetMemberId);

    if (!targetMember) {
      throw new Response("Not found", { status: 404 });
    }

    const logs = listDailyWorkLogsByMemberAndMonth(db, targetMemberId, month);
    const logsByDate = new Map(logs.map((log) => [log.workDate, log]));
    const memberQuery = isAdmin && targetMemberId !== currentMember.id ? `&memberId=${targetMemberId}` : "";
    const isLocked = isMonthLocked(db, month);
    const rows = listMonthDates(month).map((workDate) => {
      const log = logsByDate.get(workDate);
      const allocations = log ? listAllocationsByWorkLog(db, log.id) : [];
      const totalWorkingHours = log?.totalWorkingHours ?? 0;
      const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.allocatedHours, 0);
      const variance = totalWorkingHours - allocatedTotal;
      const status = getStatus({ allocatedTotal, isLocked, hasLog: Boolean(log), totalWorkingHours, variance });

      return {
        isSaturday: isSaturdayDate(workDate),
        isSunday: isSundayDate(workDate),
        isWeekend: isWeekendDate(workDate),
        workDate,
        weekday: getWeekdayLabel(workDate),
        totalWorkingHours,
        allocatedTotal,
        variance,
        status,
        dailyDetailUrl: `/work-logs/${workDate}${memberQuery ? `?${memberQuery.slice(1)}` : ""}`,
      };
    });

    return {
      currentMemberId: currentMember.id,
      isAdmin,
      isLocked,
      members: isAdmin ? listMembers(db).map(withoutMemberFinancials) : [],
      month,
      rows,
      targetMember: withoutMemberFinancials(targetMember),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const currentMember = getSessionMember(db, request);

    if (!currentMember) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const requestedMonth = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const month = isValidMonth(requestedMonth) ? requestedMonth : new Date().toISOString().slice(0, 7);
    const requestedMemberId = url.searchParams.get("memberId");
    const isAdmin = currentMember.role === "admin";
    const targetMemberId = isAdmin && requestedMemberId ? requestedMemberId : currentMember.id;
    const targetMember = findMemberById(db, targetMemberId);

    if (!targetMember) {
      throw new Response("Not found", { status: 404 });
    }

    if (isMonthLocked(db, month) && !isAdmin) {
      throw new Response("月次ロックにより編集できません", { status: 423 });
    }

    const formData = await request.formData();
    const dates = formData.getAll("date").map(String);
    const hourValues = formData.getAll("totalWorkingHours").map(String);

    for (let index = 0; index < dates.length; index += 1) {
      const workDate = dates[index];
      const rawHours = hourValues[index]?.trim() ?? "";

      if (!rawHours) {
        continue;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !workDate.startsWith(`${month}-`)) {
        return { error: "対象月の日付だけ入力できます。" };
      }

      const totalWorkingHours = Number(rawHours);

      if (!isValidQuarterHour(totalWorkingHours)) {
        return { error: "総稼働時間は 0.25h 単位で入力してください。" };
      }

      const existing = findDailyWorkLogByMemberAndDate(db, targetMemberId, workDate);

      if (existing) {
        updateDailyWorkLog(db, existing.id, { totalWorkingHours });
      } else {
        createDailyWorkLog(db, { memberId: targetMemberId, workDate, totalWorkingHours });
      }
    }

    const memberQuery = isAdmin && targetMemberId !== currentMember.id ? `&memberId=${targetMemberId}` : "";
    return redirect(`/work-logs/month?month=${month}${memberQuery}`);
  } finally {
    sqlite.close();
  }
};

export const meta = () => [{ title: "月別総稼働時間入力 | kosu" }];

export default function WorkLogMonth() {
  const { currentMemberId, isAdmin, isLocked, members, month, rows, targetMember } = useLoaderData<typeof loader>();
  const actionData = useActionData() as { error?: string } | undefined;
  const memberQuery = isAdmin && targetMember.id !== currentMemberId ? `&memberId=${targetMember.id}` : "";
  const readOnly = isLocked && !isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">月別総稼働時間入力</h1>
          <p className="text-sm text-slate-600">
            {targetMember.displayName} · {month} · 日別の総稼働時間をまとめて入力します。案件別実績工数は日別詳細で編集します。
          </p>
        </div>
        {isLocked ? <Badge tone="danger">ロック中</Badge> : <Badge tone="success">編集可能</Badge>}
      </div>

      {readOnly ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          {month} はロックされています。閲覧のみ可能です。
        </p>
      ) : null}

      {actionData?.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>対象</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="get">
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
              <label className="text-sm font-medium text-slate-800">月</label>
              <input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" defaultValue={month} name="month" type="month" />
            </div>
            <Button type="submit" variant="primary">
              表示
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>日別の総稼働時間</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" action={`/work-logs/month?month=${month}${memberQuery}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">日付</th>
                    <th className="py-2 pr-4">曜日</th>
                    <th className="py-2 pr-4 text-right">総稼働</th>
                    <th className="py-2 pr-4 text-right">案件別実績工数</th>
                    <th className="py-2 pr-4 text-right">差分</th>
                    <th className="py-2 pr-4">状態</th>
                    <th className="py-2">案件別実績工数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={`border-b border-slate-100 ${row.isSunday ? "bg-rose-50/45" : row.isSaturday ? "bg-indigo-50/35" : ""}`} key={row.workDate}>
                      <td className="py-2 pr-4 font-medium">
                        <input name="date" type="hidden" value={row.workDate} />
                        {row.workDate.slice(5)}
                      </td>
                      <td className={`py-2 pr-4 ${row.isSunday ? "font-medium text-rose-700" : row.isSaturday ? "font-medium text-indigo-700" : "text-slate-600"}`}>{row.weekday}</td>
                      <td className="py-2 pr-4 text-right">
                        <input
                          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm disabled:bg-slate-100"
                          defaultValue={row.totalWorkingHours || ""}
                          disabled={readOnly}
                          name="totalWorkingHours"
                          step="0.25"
                          type="number"
                        />
                      </td>
                      <td className="py-2 pr-4 text-right">{row.allocatedTotal}h</td>
                      <td className={`py-2 pr-4 text-right ${row.variance === 0 ? "text-slate-700" : "text-amber-700"}`}>
                        {row.variance >= 0 ? "+" : ""}{row.variance}h
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-2">
                        <Link className="text-sky-700 hover:underline" to={row.dailyDetailUrl}>
                          入力
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button disabled={readOnly} type="submit" variant="primary">
                総稼働時間を保存
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function getStatus(input: { allocatedTotal: number; hasLog: boolean; isLocked: boolean; totalWorkingHours: number; variance: number }) {
  if (input.isLocked) return "locked";
  if (!input.hasLog) return "missing";
  if (input.variance === 0) return "complete";
  if (input.variance < 0) return "overallocated";
  if (input.allocatedTotal === 0 && input.totalWorkingHours > 0) return "unallocated";
  return "incomplete";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "locked") return <Badge tone="danger">ロック中</Badge>;
  if (status === "missing") return <Badge tone="neutral">未入力</Badge>;
  if (status === "complete") return <Badge tone="success">完了</Badge>;
  if (status === "overallocated") return <Badge tone="warning">超過</Badge>;
  if (status === "unallocated") return <Badge tone="warning">未割当</Badge>;
  return <Badge tone="warning">差分あり</Badge>;
}
