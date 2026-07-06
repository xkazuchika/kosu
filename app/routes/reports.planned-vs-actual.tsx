import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/reports.planned-vs-actual";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { createDatabaseConnection } from "~/db/client";
import { listPlannedVsActualByMonth } from "~/db/repositories/effort-allocations";
import { findMemberById } from "~/db/repositories/members";
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

    const actualMap = new Map<string, number>();
    for (const a of allocations) {
      if (member.role !== "admin" && a.memberId !== member.id) continue;
      const key = `${a.memberId}|${a.projectId}`;
      actualMap.set(key, (actualMap.get(key) ?? 0) + a.allocatedHours);
    }

    const planMap = new Map<string, { memberId: string; projectId: string; plannedHours: number; roles: Set<string> }>();
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

    return { isAdmin: member.role === "admin", month, rows };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "予定対実績プレビュー | kosu" }];

export default function PlannedVsActual() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">予定対実績プレビュー</h1>
          <Badge tone="neutral">v0.2+ preview</Badge>
        </div>
        <p className="text-sm text-slate-600">
          この画面は v0.1 の主要機能ではありません。v0.1 では月次予定と基本工数レポートを公開範囲とし、完全な予定対実績レポートは v0.2 以降で整理します。
        </p>
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
          <CardTitle>予定対実績</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <EmptyState description="条件に一致する計画データがありません。" title="データがありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    {data.isAdmin ? <th className="py-2 pr-4">メンバー</th> : null}
                    <th className="py-2 pr-4">案件</th>
                    <th className="py-2 pr-4">ロール</th>
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
