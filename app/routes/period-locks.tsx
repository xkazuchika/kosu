import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/period-locks";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DataTable } from "~/components/ui/table";
import { Field, Input } from "~/components/ui/form";
import { createDatabaseConnection } from "~/db/client";
import { listPeriodLocks, lockPeriod, unlockPeriod } from "~/db/repositories/period-locks";
import { requireAdministrator } from "~/services/auth";

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);
    return { locks: listPeriodLocks(db) };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = requireAdministrator(db, request);
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "");
    const month = String(formData.get("month") ?? "");

    if (!month) {
      return { error: "対象月を指定してください。" };
    }

    const now = new Date().toISOString();

    if (intent === "lock") {
      lockPeriod(db, month, member.id, now);
    } else if (intent === "unlock") {
      unlockPeriod(db, month, member.id, now);
    } else {
      return { error: "不明な操作です。" };
    }

    return null;
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "月次ロック | kosu" }];

export default function PeriodLocks({ actionData }: Route.ComponentProps) {
  const { locks } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">月次ロック</h1>

      <Card>
        <CardHeader>
          <CardTitle>月次ロック操作</CardTitle>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <Form className="flex flex-col gap-4 sm:flex-row sm:items-end" method="post">
            <Field label="対象月">
              <Input name="month" placeholder="2026-07" required />
            </Field>
            <Button name="intent" type="submit" value="lock" variant="primary">
              ロック
            </Button>
            <Button name="intent" type="submit" value="unlock" variant="outline">
              解除
            </Button>
          </Form>
        </CardContent>
      </Card>

      <DataTable
        columns={["対象月", "状態", "操作者", "更新日時"]}
        emptyMessage="ロック状態はまだありません。"
        rows={locks.map((lock) => [
          lock.month,
          lock.isLocked ? "ロック中" : "解除済み",
          lock.lockedByMemberId ?? "-",
          lock.lockedAt ?? "-",
        ])}
      />
    </div>
  );
}
