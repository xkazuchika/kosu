import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/work-logs";

import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { listDailyWorkLogsByMember } from "~/db/repositories/daily-work-logs";
import { listAllocationsByWorkLog } from "~/db/repositories/effort-allocations";
import { getSessionMember } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const logs = listDailyWorkLogsByMember(db, member.id);

    return {
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
  const { logs } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">日次工数</h1>
      </div>
      <DataTable
        columns={["日付", "総稼働時間", "配賦合計", "差分", "状態"]}
        emptyMessage="日次工数がまだ登録されていません。"
        rows={logs.map((log) => [
          <Link className="text-sky-700 hover:underline" key={log.id} to={`/work-logs/${log.workDate}`}>
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
