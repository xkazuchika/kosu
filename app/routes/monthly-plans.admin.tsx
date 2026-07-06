import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/monthly-plans.admin";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { createMemberMonthlyCapacity, deleteMemberMonthlyCapacity, findCapacityByMemberAndMonth, updateMemberMonthlyCapacity } from "~/db/repositories/member-monthly-capacities";
import { createMonthlyPlan, deleteMonthlyPlan, findMonthlyPlan, updateMonthlyPlan } from "~/db/repositories/monthly-plans";
import { listMembers } from "~/db/repositories/members";
import { listActiveProjects } from "~/db/repositories/projects";
import { requireAdministrator } from "~/services/auth";
import { isMonthLocked, requireUnlockedMonth } from "~/services/period-lock";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? "2026-07";

    return {
      month,
      isLocked: isMonthLocked(db, month),
      members: listMembers(db),
      projects: listActiveProjects(db),
      capacities: listMembers(db).map((m) => ({ member: m, capacity: findCapacityByMemberAndMonth(db, m.id, month) })),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "");

    if (intent === "capacity") {
      const memberId = String(formData.get("memberId") ?? "");
      const month = String(formData.get("month") ?? "");
      requireUnlockedMonth(db, month);
      const capacityHours = Number(formData.get("capacityHours") ?? 0);
      const existing = findCapacityByMemberAndMonth(db, memberId, month);

      if (existing) {
        updateMemberMonthlyCapacity(db, existing.id, { capacityHours });
      } else {
        createMemberMonthlyCapacity(db, { memberId, month, capacityHours });
      }
      return null;
    }

    if (intent === "plan") {
      const memberId = String(formData.get("memberId") ?? "");
      const projectId = String(formData.get("projectId") ?? "");
      const month = String(formData.get("month") ?? "");
      requireUnlockedMonth(db, month);
      const assignmentRole = String(formData.get("assignmentRole") ?? "").trim();
      const plannedHours = Number(formData.get("plannedHours") ?? 0);
      const existing = findMonthlyPlan(db, memberId, projectId, month, assignmentRole);

      if (existing) {
        updateMonthlyPlan(db, existing.id, { plannedHours });
      } else {
        createMonthlyPlan(db, { memberId, projectId, month, assignmentRole, plannedHours });
      }
      return null;
    }

    if (intent === "deleteCapacity") {
      const id = String(formData.get("id") ?? "");
      const month = String(formData.get("month") ?? "");
      requireUnlockedMonth(db, month);
      deleteMemberMonthlyCapacity(db, id);
      return null;
    }

    if (intent === "deletePlan") {
      const id = String(formData.get("id") ?? "");
      const month = String(formData.get("month") ?? "");
      requireUnlockedMonth(db, month);
      deleteMonthlyPlan(db, id);
      return null;
    }

    return { error: "不明な操作です。" };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return { error: "保存に失敗しました。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "月次計画管理 | kosu" }];

export default function MonthlyPlansAdmin({ actionData }: Route.ComponentProps) {
  const { month, isLocked, members, projects, capacities } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">月次計画管理</h1>

      {actionData?.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </p>
      ) : null}

      {isLocked ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          {month} はロックされています。管理者のみ解除できます。
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>対象月 {month}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={["メンバー", "稼働可能時間", "操作"]}
            emptyMessage="該当データがありません。"
            rows={capacities.map(({ member, capacity }) => [
              member.displayName,
              <Form key={member.id} className="flex gap-2" method="post" action="/monthly-plans/admin">
                <input name="intent" type="hidden" value="capacity" />
                <input name="memberId" type="hidden" value={member.id} />
                <input name="month" type="hidden" value={month} />
                <Input className="w-24" defaultValue={capacity?.capacityHours ?? ""} name="capacityHours" type="number" step="0.25" />
                <Button type="submit" variant="primary">保存</Button>
                {capacity ? (
                  <>
                    <input name="id" type="hidden" value={capacity.id} />
                    <input name="month" type="hidden" value={month} />
                    <Button formAction="/monthly-plans/admin" name="intent" type="submit" value="deleteCapacity" variant="outline">
                      削除
                    </Button>
                  </>
                ) : null}
              </Form>,
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月次計画追加</CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="post" action="/monthly-plans/admin">
            <input name="intent" type="hidden" value="plan" />
            <input name="month" type="hidden" value={month} />
            <div>
              <label className="text-sm font-medium text-slate-800">メンバー</label>
              <select className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="memberId" required>
                {members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">案件</label>
              <select className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="projectId" required>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">ロール</label>
              <input className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="assignmentRole" type="text" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">予定工数</label>
              <input className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="plannedHours" type="number" step="0.25" required />
            </div>
            <Button type="submit" variant="primary">追加</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
