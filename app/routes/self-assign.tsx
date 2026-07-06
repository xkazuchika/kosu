import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/self-assign";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { listActiveAssignmentsByMember } from "~/db/repositories/project-assignments";
import { createProjectAssignment } from "~/db/repositories/project-assignments";
import { listActiveProjects } from "~/db/repositories/projects";
import { getSessionMember } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const assignments = listActiveAssignmentsByMember(db, member.id);
    const assignedProjectIds = new Set(assignments.map((a) => a.projectId));
    const availableProjects = listActiveProjects(db).filter((p) => !assignedProjectIds.has(p.id));

    return { member, availableProjects };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = getSessionMember(db, request);

    if (!member) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const formData = await request.formData();
    const projectId = String(formData.get("projectId") ?? "");

    if (!projectId) {
      return { error: "案件を選択してください。" };
    }

    createProjectAssignment(db, {
      memberId: member.id,
      projectId,
      assignmentSource: "self_assigned",
    });

    return redirect("/projects");
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "自己アサイン | kosu" }];

export default function SelfAssign({ actionData }: Route.ComponentProps) {
  const { availableProjects } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>既存案件に自己アサイン</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <DataTable
            columns={["コード", "名前", "タイプ", "アサイン"]}
            emptyMessage="自己アサインできる有効な案件がありません。"
            rows={availableProjects.map((project) => [
              project.code,
              project.name,
              project.projectType,
              <Form key={project.id} method="post">
                <input name="projectId" type="hidden" value={project.id} />
                <Button type="submit" variant="primary">
                  アサインする
                </Button>
              </Form>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
