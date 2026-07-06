import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/profile";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { updateMember } from "~/db/repositories/members";
import { requireAuth } from "~/services/auth";
import { hashPassword } from "~/lib/password";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = requireAuth(db, request);
    return { member };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = requireAuth(db, request);
    const formData = await request.formData();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!displayName) {
      return { error: "氏名は必須です。" };
    }

    const updates: Parameters<typeof updateMember>[2] = { displayName };

    if (password) {
      if (password.length < 8) {
        return { error: "パスワードは8文字以上です。" };
      }
      updates.passwordHash = await hashPassword(password);
    }

    updateMember(db, member.id, updates);

    return redirect("/dashboard");
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "プロフィール | kosu" }];

export default function Profile({ actionData }: Route.ComponentProps) {
  const { member } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール編集</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <Field label="氏名">
              <Input name="displayName" defaultValue={member.displayName} required />
            </Field>
            <Field label="メールアドレス">
              <Input defaultValue={member.email} disabled />
            </Field>
            <Field label="新しいパスワード" help="変更しない場合は空欄のまま">
              <Input name="password" type="password" minLength={8} />
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
