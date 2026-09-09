import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/projects.$id.assignments";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import {
  listMembers,
  withoutMemberFinancials,
} from "~/db/repositories/members";
import {
  findProjectAssignmentById,
  listAssignmentsByProject,
  removeProjectAssignment,
} from "~/db/repositories/project-assignments";
import { findProjectById } from "~/db/repositories/projects";
import { requireAdministrator } from "~/services/auth";
import {
  createValidatedProjectAssignment,
  ProjectAssignmentError,
  updateActiveProjectAssignmentRole,
} from "~/services/project-assignment";

export const loader = async ({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const project = findProjectById(db, params.id);

    if (!project) {
      throw new Response("Not found", { status: 404 });
    }

    return {
      project,
      assignments: listAssignmentsByProject(db, params.id),
      members: listMembers(db).map(withoutMemberFinancials),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "assign");

    if (intent === "remove") {
      const assignmentId = String(formData.get("assignmentId") ?? "");
      const assignment = findProjectAssignmentById(db, assignmentId);
      if (
        !assignment ||
        assignment.projectId !== params.id ||
        assignment.removedAt
      ) {
        return { error: "有効なアサインが見つかりません。" };
      }
      removeProjectAssignment(db, assignmentId, new Date().toISOString());
      return null;
    }

    if (intent === "updateRole") {
      const memberId = String(formData.get("memberId") ?? "");
      const assignmentRole =
        String(formData.get("assignmentRole") ?? "").trim() || null;
      try {
        updateActiveProjectAssignmentRole(db, {
          memberId,
          projectId: params.id,
          assignmentRole,
        });
        return null;
      } catch (error) {
        if (error instanceof ProjectAssignmentError) {
          return { error: error.message };
        }
        throw error;
      }
    }

    const memberId = String(formData.get("memberId") ?? "");
    const assignmentRole =
      String(formData.get("assignmentRole") ?? "").trim() || undefined;

    if (!memberId) {
      return { error: "メンバーを選択してください。" };
    }

    try {
      createValidatedProjectAssignment(db, {
        memberId,
        projectId: params.id,
        assignmentRole,
      });
      return null;
    } catch (error) {
      if (error instanceof ProjectAssignmentError) {
        return { error: error.message };
      }
      throw error;
    }
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "アサイン | kosu" }];

export default function ProjectAssignments({
  actionData,
}: Route.ComponentProps) {
  const { project, assignments, members } = useLoaderData<typeof loader>();
  const assignedMemberIds = new Set(
    assignments.filter((a) => !a.removedAt).map((a) => a.memberId),
  );
  const availableMembers = members.filter(
    (m) => m.isActive && !assignedMemberIds.has(m.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {project.name} のアサイン
        </h1>
        <Link
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          to="/projects"
        >
          案件一覧へ
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>メンバーアサイン</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p
              className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {actionData.error}
            </p>
          ) : null}
          <Form
            method="post"
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-800">
                メンバー
              </label>
              <select
                aria-label="メンバー"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                name="memberId"
                required
              >
                <option value="">選択してください</option>
                {availableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} ({member.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-800">
                担当ロール
              </label>
              <input
                aria-label="担当ロール"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                name="assignmentRole"
                placeholder="PM, Engineer など"
                type="text"
              />
            </div>
            <Button type="submit" variant="primary">
              アサイン
            </Button>
          </Form>
        </CardContent>
      </Card>

      <DataTable
        columns={["メンバー", "担当ロール", "ソース", "操作"]}
        emptyMessage="アサインされているメンバーはいません。"
        rows={assignments
          .filter((a) => !a.removedAt)
          .map((assignment) => {
            const member = members.find((m) => m.id === assignment.memberId);
            return [
              member?.displayName ?? "不明",
              assignment.assignmentRole ?? "-",
              assignment.assignmentSource === "self_assigned"
                ? "自己アサイン"
                : "管理者",
              <div key={assignment.id} className="flex flex-wrap gap-2">
                <Form
                  method="post"
                  action={`/projects/${project.id}/assignments`}
                  className="flex gap-2"
                >
                  <input name="intent" type="hidden" value="updateRole" />
                  <input
                    name="memberId"
                    type="hidden"
                    value={assignment.memberId}
                  />
                  <input
                    aria-label={`${member?.displayName ?? "メンバー"}の担当ロール`}
                    className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    name="assignmentRole"
                    defaultValue={assignment.assignmentRole ?? ""}
                  />
                  <Button type="submit" variant="outline">
                    ロール保存
                  </Button>
                </Form>
                <Form
                  method="post"
                  action={`/projects/${project.id}/assignments`}
                >
                  <input name="intent" type="hidden" value="remove" />
                  <input
                    name="assignmentId"
                    type="hidden"
                    value={assignment.id}
                  />
                  <Button type="submit" variant="outline">
                    解除
                  </Button>
                </Form>
              </div>,
            ];
          })}
      />
    </div>
  );
}
