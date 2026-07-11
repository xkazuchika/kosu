import { Form, Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/projects.$id";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { archiveProject, findProjectById, unarchiveProject, updateProject } from "~/db/repositories/projects";
import { parseOptionalYen } from "~/lib/currency";
import { requireAdministrator } from "~/services/auth";

export const loader = async ({ request, params }: { request: Request; params: { id: string } }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const project = findProjectById(db, params.id);

    if (!project) {
      throw new Response("Not found", { status: 404 });
    }

    return { project };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);

    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "update");

    if (intent === "archive") {
      archiveProject(db, params.id, new Date().toISOString());
      return redirect("/projects");
    }

    if (intent === "unarchive") {
      unarchiveProject(db, params.id);
      return redirect("/projects");
    }

    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const projectType = String(formData.get("projectType") ?? "");
    const clientName = String(formData.get("clientName") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim() || null;
    const contractRevenueAmount = parseOptionalYen(formData.get("contractRevenueAmount"));
    const laborCostBudgetAmount = parseOptionalYen(formData.get("laborCostBudgetAmount"));

    if (!code || !name || !projectType) {
      return { error: "コード、名前、タイプは必須です。" };
    }

    if (projectType !== "billable" && projectType !== "internal" && projectType !== "non_billable") {
      return { error: "案件タイプが不正です。" };
    }

    if (contractRevenueAmount === undefined || laborCostBudgetAmount === undefined) {
      return { error: "契約売上と人件費予算は0以上の整数（円）で入力してください。" };
    }

    updateProject(db, params.id, { code, name, projectType, clientName, description, contractRevenueAmount, laborCostBudgetAmount });

    return redirect("/projects");
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return { error: "案件の更新に失敗しました。コードが重複している可能性があります。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "案件編集 | kosu" }];

export default function EditProject({ actionData }: Route.ComponentProps) {
  const { project } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>案件編集</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <input name="intent" type="hidden" value="update" />
            <Field label="案件コード">
              <Input name="code" defaultValue={project.code} required />
            </Field>
            <Field label="案件名">
              <Input name="name" defaultValue={project.name} required />
            </Field>
            <Field label="タイプ">
              <select
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                defaultValue={project.projectType}
                name="projectType"
                required
              >
                <option value="billable">請求対象</option>
                <option value="internal">社内</option>
                <option value="non_billable">非請求</option>
              </select>
            </Field>
            <Field label="クライアント名">
              <Input name="clientName" defaultValue={project.clientName ?? ""} />
            </Field>
            <Field label="説明">
              <Input name="description" defaultValue={project.description ?? ""} />
            </Field>
            <Field label="契約売上（税抜・円）" help="請求対象案件の契約金額です。管理者のみ表示されます。">
              <Input defaultValue={project.contractRevenueAmount ?? ""} min="0" name="contractRevenueAmount" step="1" type="number" />
            </Field>
            <Field label="人件費予算（税抜・円）" help="直接人件費として使える上限です。管理者のみ表示されます。">
              <Input defaultValue={project.laborCostBudgetAmount ?? ""} min="0" name="laborCostBudgetAmount" step="1" type="number" />
            </Field>
            {project.revenueOrBudgetAmount !== null && project.contractRevenueAmount === null && project.laborCostBudgetAmount === null ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                旧「売上または予算」は {project.revenueOrBudgetAmount.toLocaleString()} 円です。意味を自動判定できないため、契約売上または人件費予算として改めて入力してください。
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                保存する
              </Button>
              <Link
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                to={`/projects/${project.id}/tasks`}
              >
                タスク管理（任意）
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                to={`/projects/${project.id}/assignments`}
              >
                アサイン管理
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                to={`/reports/project-financials?projectId=${project.id}`}
              >
                案件財務レビュー
              </Link>
            </div>
          </Form>
          <Form className="mt-4" method="post" action={`/projects/${project.id}`}>
            <input name="intent" type="hidden" value={project.isArchived ? "unarchive" : "archive"} />
            <Button type="submit" variant="outline">
              {project.isArchived ? "アーカイブ解除" : "アーカイブ"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
