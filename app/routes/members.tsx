import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/members";

import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { listMembers } from "~/db/repositories/members";
import { requireAdministrator } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const members = listMembers(db);
    return { members };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "メンバー | kosu" }];

export default function Members() {
  const { members } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">メンバー</h1>
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
          to="/members/new"
        >
          メンバーを追加
        </Link>
      </div>
      <DataTable
        columns={["氏名", "メール", "ロール", "部署", "時給原価", "状態"]}
        emptyMessage="メンバーがまだ登録されていません。"
        rows={members.map((member) => [
          <Link className="text-sky-700 hover:underline" key={member.id} to={`/members/${member.id}`}>
            {member.displayName}
          </Link>,
          member.email,
          member.role === "admin" ? "管理者" : "メンバー",
          member.departmentName ?? "-",
          member.hourlyCostRate?.toString() ?? "-",
          member.isActive ? "有効" : "無効",
        ])}
      />
    </div>
  );
}
