import { Link, useLoaderData } from "react-router";

import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { listActiveAssignmentsByMember } from "~/db/repositories/project-assignments";
import { listActiveProjects, listProjects } from "~/db/repositories/projects";
import { getSessionMember } from "~/services/auth";

import type { Route } from "./+types/projects";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    if (member.role === "admin") {
      return { projects: listProjects(db), isAdmin: true };
    }

    const assignments = listActiveAssignmentsByMember(db, member.id);
    const projectIds = new Set(assignments.map((a) => a.projectId));
    const allActive = listActiveProjects(db);

    return { projects: allActive.filter((p) => projectIds.has(p.id)), isAdmin: false };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "案件 | kosu" }];

export default function Projects() {
  const { projects, isAdmin } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">案件</h1>
        {isAdmin ? (
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
            to="/projects/new"
          >
            案件を追加
          </Link>
        ) : null}
      </div>
      <DataTable
        columns={isAdmin ? ["コード", "名前", "タイプ", "クライアント", "状態", "操作"] : ["コード", "名前", "タイプ", "クライアント", "状態"]}
        emptyMessage="案件がまだ登録されていません。"
        rows={projects.map((project) => {
          const baseRows = [
            isAdmin ? (
              <Link className="text-sky-700 hover:underline" key={project.id} to={`/projects/${project.id}`}>
                {project.code}
              </Link>
            ) : (
              project.code
            ),
            project.name,
            project.projectType,
            project.clientName ?? "-",
            project.isArchived ? <Badge tone="neutral">アーカイブ</Badge> : <Badge tone="success">有効</Badge>,
          ];

          return isAdmin
            ? [
                ...baseRows,
                <Link className="text-sky-700 hover:underline" key={`${project.id}-assignments`} to={`/projects/${project.id}/assignments`}>
                  アサイン
                </Link>,
              ]
            : baseRows;
        })}
      />
    </div>
  );
}
