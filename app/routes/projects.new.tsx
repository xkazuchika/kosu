import { Form, redirect } from "react-router";
import type { Route } from "./+types/projects.new";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { createProject } from "~/db/repositories/projects";
import { requireAdministrator } from "~/services/auth";

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);

    const formData = await request.formData();
    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const projectType = String(formData.get("projectType") ?? "");
    const clientName = String(formData.get("clientName") ?? "").trim() || undefined;
    const description = String(formData.get("description") ?? "").trim() || undefined;
    const revenueRaw = String(formData.get("revenueOrBudgetAmount") ?? "").trim();
    const revenueOrBudgetAmount = revenueRaw ? Number(revenueRaw) : undefined;

    if (!code || !name || !projectType) {
      return { error: "コード、名前、タイプは必須です。" };
    }

    if (projectType !== "billable" && projectType !== "internal" && projectType !== "non_billable") {
      return { error: "案件タイプが不正です。" };
    }

    createProject(db, { code, name, projectType, clientName, description, revenueOrBudgetAmount });

    return redirect("/projects");
  } catch {
    return { error: "案件の作成に失敗しました。コードが重複している可能性があります。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "案件追加 | kosu" }];

export default function NewProject({ actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>案件追加</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <Field label="案件コード">
              <Input name="code" required />
            </Field>
            <Field label="案件名">
              <Input name="name" required />
            </Field>
            <Field label="タイプ">
              <select className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="projectType" required>
                <option value="billable">請求対象</option>
                <option value="internal">社内</option>
                <option value="non_billable">非請求</option>
              </select>
            </Field>
            <Field label="クライアント名">
              <Input name="clientName" />
            </Field>
            <Field label="説明">
              <Input name="description" />
            </Field>
            <Field label="売上または予算（円）" help="管理者のみ表示されます">
              <Input name="revenueOrBudgetAmount" type="number" />
            </Field>
            <Button type="submit" variant="primary">
              作成する
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
