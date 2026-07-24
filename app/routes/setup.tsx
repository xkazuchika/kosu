import { Form, redirect } from "react-router";
import type { Route } from "./+types/setup";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { normalizeTimeZone } from "~/lib/time";
import { setupWorkspace, isSetupComplete, createMemberSession } from "~/services/auth";
import { setSessionCookie } from "~/services/session";

export const loader = async () => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    if (isSetupComplete(db)) {
      return redirect("/login");
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
    if (isSetupComplete(db)) {
      return redirect("/login");
    }

    const workspaceName = String(formData.get("workspaceName") ?? "").trim();
    const defaultTimezone = String(formData.get("defaultTimezone") ?? "").trim();
    const administratorName = String(formData.get("administratorName") ?? "").trim();
    const administratorEmail = String(formData.get("administratorEmail") ?? "").trim();
    const administratorPassword = String(formData.get("administratorPassword") ?? "");
    const normalizedTimezone = normalizeTimeZone(defaultTimezone);

    if (
      !workspaceName ||
      !administratorName ||
      !administratorEmail ||
      administratorPassword.length < 8
    ) {
      return { error: "すべての必須項目を入力してください。パスワードは8文字以上です。" };
    }

    if (!normalizedTimezone) {
      return { error: "有効なタイムゾーンを入力してください（例: Asia/Tokyo）。" };
    }

    const { administrator } = await setupWorkspace(db, {
      workspaceName,
      defaultTimezone: normalizedTimezone,
      administratorName,
      administratorEmail,
      administratorPassword,
    });

    const session = createMemberSession(db, administrator.id);

    return redirect("/dashboard", {
      headers: { "Set-Cookie": setSessionCookie(session.id) },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Setup is already complete") {
      return redirect("/login");
    }

    throw error;
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [
  { title: "初期セットアップ | kosu" },
];

export default function Setup({ actionData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>kosu 初期セットアップ</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <Field label="ワークスペース名">
              <Input name="workspaceName" required />
            </Field>
            <Field label="タイムゾーン">
              <Input name="defaultTimezone" defaultValue="Asia/Tokyo" required />
            </Field>
            <Field label="管理者氏名">
              <Input name="administratorName" required />
            </Field>
            <Field label="管理者メールアドレス">
              <Input name="administratorEmail" type="email" required />
            </Field>
            <Field label="管理者パスワード">
              <Input name="administratorPassword" type="password" minLength={8} required />
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              セットアップを完了する
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
