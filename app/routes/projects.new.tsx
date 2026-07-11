import { Form, redirect } from "react-router";
import type { Route } from "./+types/projects.new";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { createProject } from "~/db/repositories/projects";
import { parseOptionalYen } from "~/lib/currency";
import { requireAdministrator } from "~/services/auth";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    return null;
  } finally {
    sqlite.close();
  }
};

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

    createProject(db, { code, name, projectType, clientName, description, contractRevenueAmount, laborCostBudgetAmount });

    return redirect("/projects");
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
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
            <Field label="契約売上（税抜・円）" help="請求対象案件の契約金額です。管理者のみ表示されます。">
              <Input min="0" name="contractRevenueAmount" step="1" type="number" />
            </Field>
            <Field label="人件費予算（税抜・円）" help="直接人件費として使える上限です。管理者のみ表示されます。">
              <Input min="0" name="laborCostBudgetAmount" step="1" type="number" />
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
