import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/settings";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { updateWorkspace, findWorkspace } from "~/db/repositories/workspace";
import { requireAdministrator } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const workspace = findWorkspace(db);

    if (!workspace) {
      return redirect("/setup");
    }

    return { workspace };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);

    const formData = await request.formData();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const defaultTimezone = String(formData.get("defaultTimezone") ?? "").trim();

    if (!displayName || !defaultTimezone) {
      return { error: "ワークスペース名とタイムゾーンは必須です。" };
    }

    const workspace = findWorkspace(db);

    if (!workspace) {
      return redirect("/setup");
    }

    updateWorkspace(db, workspace.id, { displayName, defaultTimezone });

    return redirect("/settings");
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "設定 | kosu" }];

export default function Settings() {
  const { workspace } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>ワークスペース設定</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <Field label="ワークスペース名">
              <Input name="displayName" defaultValue={workspace.displayName} required />
            </Field>
            <Field label="デフォルトタイムゾーン">
              <Input name="defaultTimezone" defaultValue={workspace.defaultTimezone} required />
            </Field>
            <Button type="submit" variant="primary">
              保存する
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
