import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/members.$id";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { activateMember, deactivateMember, findMemberById, updateMember, withoutMemberPasswordHash } from "~/db/repositories/members";
import { requireAdministrator } from "~/services/auth";
import { hashPassword } from "~/lib/password";

export const loader = async ({ request, params }: { request: Request; params: { id: string } }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    const member = findMemberById(db, params.id);

    if (!member) {
      throw new Response("Not found", { status: 404 });
    }

    return { member: withoutMemberPasswordHash(member) };
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

    if (intent === "deactivate") {
      deactivateMember(db, params.id);
      return redirect("/members");
    }

    if (intent === "activate") {
      activateMember(db, params.id);
      return redirect("/members");
    }

    const displayName = String(formData.get("displayName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "member");
    const departmentName = String(formData.get("departmentName") ?? "").trim() || null;
    const hourlyCostRateRaw = String(formData.get("hourlyCostRate") ?? "").trim();
    const hourlyCostRate = hourlyCostRateRaw ? Number(hourlyCostRateRaw) : null;
    const password = String(formData.get("password") ?? "");

    if (!displayName || !email) {
      return { error: "氏名とメールは必須です。" };
    }

    if (role !== "admin" && role !== "member") {
      return { error: "権限が不正です。" };
    }

    const updates: Parameters<typeof updateMember>[2] = {
      displayName,
      email,
      role,
      departmentName,
      hourlyCostRate,
    };

    if (password) {
      if (password.length < 8) {
        return { error: "パスワードは8文字以上です。" };
      }
      updates.passwordHash = await hashPassword(password);
    }

    updateMember(db, params.id, updates);

    return redirect("/members");
  } catch {
    return { error: "メンバーの更新に失敗しました。メールアドレスが重複している可能性があります。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "メンバー編集 | kosu" }];

export default function EditMember({ actionData }: Route.ComponentProps) {
  const { member } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>メンバー編集</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form method="post" className="space-y-4">
            <input name="intent" type="hidden" value="update" />
            <Field label="氏名">
              <Input name="displayName" defaultValue={member.displayName} required />
            </Field>
            <Field label="メールアドレス">
              <Input name="email" type="email" defaultValue={member.email} required />
            </Field>
            <Field label="権限">
              <select
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                defaultValue={member.role}
                name="role"
                required
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </Field>
            <Field label="部署">
              <Input name="departmentName" defaultValue={member.departmentName ?? ""} />
            </Field>
            <Field label="時間あたり原価（円）" help="管理者のみ表示されます">
              <Input name="hourlyCostRate" type="number" defaultValue={member.hourlyCostRate ?? ""} />
            </Field>
            <Field label="新しいパスワード" help="変更しない場合は空欄のまま">
              <Input name="password" type="password" minLength={8} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                保存する
              </Button>
            </div>
          </Form>
          <Form className="mt-4" method="post" action={`/members/${member.id}`}>
            <input name="intent" type="hidden" value={member.isActive ? "deactivate" : "activate"} />
            <Button type="submit" variant="outline">
              {member.isActive ? "無効化" : "有効化"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
