import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/reports.resource-planning";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { createDatabaseConnection } from "~/db/client";
import { findCapacityByMemberAndMonth } from "~/db/repositories/member-monthly-capacities";
import { listMembers } from "~/db/repositories/members";
import { listMonthlyPlansByMemberAndMonth } from "~/db/repositories/monthly-plans";
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

    const targetMembers = member.role === "admin" ? listMembers(db).filter((m) => m.isActive) : [member];

    const rows = targetMembers.map((m) => {
      const capacity = findCapacityByMemberAndMonth(db, m.id, month);
      const plans = listMonthlyPlansByMemberAndMonth(db, m.id, month);
      const plannedHours = plans.reduce((sum: number, p) => sum + p.plannedHours, 0);
      const capacityHours = capacity?.capacityHours ?? 0;

      return {
        memberId: m.id,
        memberName: m.displayName,
        departmentName: m.departmentName,
        capacityHours,
        plannedHours,
        unallocatedCapacity: Math.max(0, capacityHours - plannedHours),
        overplannedHours: Math.max(0, plannedHours - capacityHours),
      };
    });

    return { isAdmin: member.role === "admin", month, rows };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "リソース計画プレビュー | kosu" }];

export default function ResourcePlanning() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">リソース計画プレビュー</h1>
          <Badge tone="neutral">v0.2+ preview</Badge>
        </div>
        <p className="text-sm text-slate-600">
          この画面は v0.1 の主要機能ではありません。v0.1 では月次キャパシティと月次予定の入力を公開範囲とし、部門・メンバー・ロール・案件で絞り込む本格的なリソース計画は v0.2 以降で整理します。
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
          <CardTitle>キャパシティ対予定</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <EmptyState description="対象メンバーがいません。" title="データがありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    {data.isAdmin ? <th className="py-2 pr-4">メンバー</th> : null}
                    {data.isAdmin ? <th className="py-2 pr-4">部署</th> : null}
                    <th className="py-2 pr-4 text-right">キャパシティ</th>
                    <th className="py-2 pr-4 text-right">予定</th>
                    <th className="py-2 pr-4 text-right">未配分</th>
                    <th className="py-2 text-right">超過</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.memberId} className="border-b border-slate-100">
                      {data.isAdmin ? <td className="py-2 pr-4">{row.memberName}</td> : null}
                      {data.isAdmin ? <td className="py-2 pr-4">{row.departmentName ?? "-"}</td> : null}
                      <td className="py-2 pr-4 text-right">{row.capacityHours}h</td>
                      <td className="py-2 pr-4 text-right">{row.plannedHours}h</td>
                      <td className="py-2 pr-4 text-right">{row.unallocatedCapacity}h</td>
                      <td className="py-2 text-right">
                        {row.overplannedHours > 0 ? (
                          <Badge tone="warning">{row.overplannedHours}h</Badge>
                        ) : (
                          <span className="text-slate-600">0h</span>
                        )}
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
