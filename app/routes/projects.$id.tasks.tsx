import { Form, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/projects.$id.tasks";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { DataTable } from "~/components/ui/table";
import { createDatabaseConnection } from "~/db/client";
import { findProjectById } from "~/db/repositories/projects";
import { archiveTask, createTask, listTasksByProject, unarchiveTask } from "~/db/repositories/tasks";
import { requireAdministrator } from "~/services/auth";

export const loader = async ({ request, params }: { request: Request; params: { id: string } }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const project = findProjectById(db, params.id);

    if (!project) {
      throw new Response("Not found", { status: 404 });
    }

    return { project, tasks: listTasksByProject(db, params.id) };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "create");

    if (intent === "archive") {
      const taskId = String(formData.get("taskId") ?? "");
      archiveTask(db, taskId, new Date().toISOString());
      return null;
    }

    if (intent === "unarchive") {
      const taskId = String(formData.get("taskId") ?? "");
      unarchiveTask(db, taskId);
      return null;
    }

    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      return { error: "タスク名は必須です。" };
    }

    createTask(db, { projectId: params.id, name });
    return null;
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "タスク | kosu" }];

export default function ProjectTasks({ actionData }: Route.ComponentProps) {
  const { project, tasks } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {project.name} のタスク（任意）
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
          <CardTitle>新規タスク</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <p className="mb-4 text-sm text-slate-600">
            タスクは案件内の工数を細かく分けたい場合だけ使います。使わない場合は、日別工数実績入力で案件だけを選んで実績工数を登録できます。
          </p>
          <Form method="post" className="flex gap-2">
            <Field label="">
              <Input name="name" placeholder="タスク名" required />
            </Field>
            <Button className="self-end" type="submit" variant="primary">
              追加
            </Button>
          </Form>
        </CardContent>
      </Card>

      <DataTable
        columns={["名前", "状態", "操作"]}
        emptyMessage="タスクがまだ登録されていません。"
        rows={tasks.map((task) => [
          task.name,
          task.isArchived ? <Badge tone="neutral">アーカイブ</Badge> : <Badge tone="success">有効</Badge>,
          <Form key={task.id} method="post" action={`/projects/${project.id}/tasks`}>
            <input name="intent" type="hidden" value={task.isArchived ? "unarchive" : "archive"} />
            <input name="taskId" type="hidden" value={task.id} />
            <Button type="submit" variant="outline">
              {task.isArchived ? "解除" : "アーカイブ"}
            </Button>
          </Form>,
        ])}
      />
    </div>
  );
}
