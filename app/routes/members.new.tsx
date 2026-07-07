import { Form, redirect } from "react-router";
import type { Route } from "./+types/members.new";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { createMember } from "~/db/repositories/members";
import { requireAdministrator } from "~/services/auth";
import { hashPassword } from "~/lib/password";

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);

    const formData = await request.formData();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "member");
    const departmentName = String(formData.get("departmentName") ?? "").trim() || undefined;
    const hourlyCostRateRaw = String(formData.get("hourlyCostRate") ?? "").trim();
    const hourlyCostRate = hourlyCostRateRaw ? Number(hourlyCostRateRaw) : undefined;
    const password = String(formData.get("password") ?? "");

    if (!displayName || !email || !password || password.length < 8) {
      return { error: "氏名、メール、8文字以上のパスワードは必須です。" };
    }

    if (role !== "admin" && role !== "member") {
      return { error: "権限が不正です。" };
    }

    const passwordHash = await hashPassword(password);

    createMember(db, {
      displayName,
      email,
      passwordHash,
      role,
      departmentName,
      hourlyCostRate,
    });

    return redirect("/members");
  } catch {
    return { error: "メンバーの作成に失敗しました。メールアドレスが重複している可能性があります。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "メンバー追加 | kosu" }];

export default function NewMember({ actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>メンバー追加</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <Field label="氏名">
              <Input name="displayName" required />
            </Field>
            <Field label="メールアドレス">
              <Input name="email" type="email" required />
            </Field>
            <Field label="権限">
              <select
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                name="role"
                required
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </Field>
            <Field label="部署">
              <Input name="departmentName" />
            </Field>
            <Field label="時間あたり原価（円）" help="管理者のみ表示されます">
              <Input name="hourlyCostRate" type="number" />
            </Field>
            <Field label="パスワード">
              <Input name="password" type="password" minLength={8} required />
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
