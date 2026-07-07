import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/reports.planned-vs-actual";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { createDatabaseConnection } from "~/db/client";
import { listPlannedVsActualByMonth } from "~/db/repositories/effort-allocations";
import { findCapacityByMemberAndMonth } from "~/db/repositories/member-monthly-capacities";
import { findMemberById, listMembers } from "~/db/repositories/members";
import { findProjectById } from "~/db/repositories/projects";
import { getSessionMember } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

    const { allocations, plans } = listPlannedVsActualByMonth(db, month);
    const visibleMembers = listMembers(db).filter((item) => member.role === "admin" || item.id === member.id);

    const actualMap = new Map<string, number>();
    const actualByMember = new Map<string, number>();
    for (const a of allocations) {
      if (member.role !== "admin" && a.memberId !== member.id) continue;
      const key = `${a.memberId}|${a.projectId}`;
      actualMap.set(key, (actualMap.get(key) ?? 0) + a.allocatedHours);
      actualByMember.set(a.memberId, (actualByMember.get(a.memberId) ?? 0) + a.allocatedHours);
    }

    const planMap = new Map<string, { memberId: string; projectId: string; plannedHours: number; roles: Set<string> }>();
    const plannedByMember = new Map<string, number>();
    for (const p of plans) {
      if (member.role !== "admin" && p.memberId !== member.id) continue;
      const key = `${p.memberId}|${p.projectId}`;
      const existing = planMap.get(key) ?? {
        memberId: p.memberId,
        projectId: p.projectId,
        plannedHours: 0,
        roles: new Set<string>(),
      };
      existing.plannedHours += p.plannedHours;
      if (p.assignmentRole) existing.roles.add(p.assignmentRole);
      planMap.set(key, existing);
      plannedByMember.set(p.memberId, (plannedByMember.get(p.memberId) ?? 0) + p.plannedHours);
    }

    const keys = new Set([...planMap.keys(), ...actualMap.keys()]);
    const rows = [...keys].map((key) => {
      const plan = planMap.get(key);
      const [memberId, projectId] = key.split("|");
      const actual = actualMap.get(key) ?? 0;
      const planned = plan?.plannedHours ?? 0;

      return {
        memberId,
        memberName: findMemberById(db, memberId)?.displayName ?? memberId,
        projectId,
        projectName: findProjectById(db, projectId)?.name ?? projectId,
        assignmentRole: plan && plan.roles.size > 0 ? [...plan.roles].join(" / ") : "-",
        plannedHours: planned,
        actualHours: actual,
        variance: actual - planned,
      };
    });

    const capacityRows = visibleMembers
      .map((visibleMember) => {
        const capacity = findCapacityByMemberAndMonth(db, visibleMember.id, month);
        const capacityHours = capacity?.capacityHours ?? 0;
        const totalPlanned = plannedByMember.get(visibleMember.id) ?? 0;
        const totalActual = actualByMember.get(visibleMember.id) ?? 0;

        return {
          memberId: visibleMember.id,
          memberName: visibleMember.displayName,
          capacityHours,
          totalPlanned,
          totalActual,
          unallocatedCapacity: Math.max(capacityHours - totalPlanned, 0),
          overplannedHours: Math.max(totalPlanned - capacityHours, 0),
        };
      })
      .filter((row) => row.capacityHours > 0 || row.totalPlanned > 0 || row.totalActual > 0);

    return {
      capacityRows,
      hasPlans: planMap.size > 0,
      isAdmin: member.role === "admin",
      month,
      planningState: planMap.size > 0 ? "ready" : "missing-plans",
      rows,
    };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "予定対実績 | kosu" }];

export default function PlannedVsActual() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">予定対実績</h1>
          <Badge tone="success">v0.2</Badge>
        </div>
        <p className="text-sm text-slate-600">
          月次予定と実績配賦を比較します。日別の総稼働時間は月次一括入力、案件別の実績は日次詳細の配賦から集計します。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to={`/work-logs/month?month=${data.month}`}>
          月次一括入力
        </Link>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" to="/monthly-plans">
          月次予定
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="get">
            <div>
              <label className="text-sm font-medium text-slate-800">月</label>
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                defaultValue={data.month}
                name="month"
                type="month"
              />
            </div>
            <Button type="submit" variant="primary">
              適用
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>稼働予定時間との比較</CardTitle>
        </CardHeader>
        <CardContent>
          {data.capacityRows.length === 0 ? (
            <EmptyState description="月次稼働予定時間がまだ登録されていません。" title="稼働予定時間がありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    {data.isAdmin ? <th className="py-2 pr-4">メンバー</th> : null}
                    <th className="py-2 pr-4 text-right">稼働予定</th>
                    <th className="py-2 pr-4 text-right">予定</th>
                    <th className="py-2 pr-4 text-right">実績</th>
                    <th className="py-2 pr-4 text-right">未予定</th>
                    <th className="py-2 text-right">予定超過</th>
                  </tr>
                </thead>
                <tbody>
                  {data.capacityRows.map((row) => (
                    <tr key={row.memberId} className="border-b border-slate-100">
                      {data.isAdmin ? <td className="py-2 pr-4">{row.memberName}</td> : null}
                      <td className="py-2 pr-4 text-right">{row.capacityHours}h</td>
                      <td className="py-2 pr-4 text-right">{row.totalPlanned}h</td>
                      <td className="py-2 pr-4 text-right">{row.totalActual}h</td>
                      <td className="py-2 pr-4 text-right">{row.unallocatedCapacity}h</td>
                      <td className={`py-2 text-right ${row.overplannedHours > 0 ? "text-red-700" : ""}`}>{row.overplannedHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>予定対実績</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <EmptyState description="月次予定を登録すると、案件別の予定対実績を確認できます。" title="月次予定がありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    {data.isAdmin ? <th className="py-2 pr-4">メンバー</th> : null}
                    <th className="py-2 pr-4">案件</th>
                    <th className="py-2 pr-4">担当ロール</th>
                    <th className="py-2 pr-4 text-right">予定</th>
                    <th className="py-2 pr-4 text-right">実績</th>
                    <th className="py-2 text-right">差分</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {data.isAdmin ? <td className="py-2 pr-4">{row.memberName}</td> : null}
                      <td className="py-2 pr-4">{row.projectName}</td>
                      <td className="py-2 pr-4">{row.assignmentRole}</td>
                      <td className="py-2 pr-4 text-right">{row.plannedHours}h</td>
                      <td className="py-2 pr-4 text-right">{row.actualHours}h</td>
                      <td className={`py-2 text-right ${row.variance > 0 ? "text-amber-700" : ""}`}>
                        {row.variance >= 0 ? "+" : ""}
                        {row.variance}h
                      </td>
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
