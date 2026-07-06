import { Form, redirect } from "react-router";
import type { Route } from "./+types/login";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { authenticateMember, createMemberSession, isSetupComplete } from "~/services/auth";
import { setSessionCookie } from "~/services/session";

export const loader = async () => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    if (!isSetupComplete(db)) {
      return redirect("/setup");
    }

    return null;
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const { db, sqlite } = createDatabaseConnection();

  try {
    if (!isSetupComplete(db)) {
      return redirect("/setup");
    }

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const member = await authenticateMember(db, { email, password });

    if (!member) {
      return { error: "メールアドレスまたはパスワードが正しくありません。" };
    }

    const session = createMemberSession(db, member.id);

    return redirect("/dashboard", {
      headers: { "Set-Cookie": setSessionCookie(session.id) },
    });
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "ログイン | kosu" }];

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>kosu にログイン</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <Field label="メールアドレス">
              <Input name="email" type="email" required />
            </Field>
            <Field label="パスワード">
              <Input name="password" type="password" required />
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              ログイン
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
