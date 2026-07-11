import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/imports";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createDatabaseConnection } from "~/db/client";
import { createImportJob, listImportJobs } from "~/db/repositories/import-jobs";
import { listCapacitiesByMember } from "~/db/repositories/member-monthly-capacities";
import { listMembers } from "~/db/repositories/members";
import { listMonthlyPlansByMember } from "~/db/repositories/monthly-plans";
import { listAssignmentsByMember } from "~/db/repositories/project-assignments";
import { findProjectById, listProjects } from "~/db/repositories/projects";
import { requireAdministrator } from "~/services/auth";
import { parseCsv, stringifyCsv } from "~/lib/csv";
import { commitImport, getImportTemplate, isImportType, previewImport, type ImportType, type ImportPreview } from "~/services/import";

type ImportActionData =
  | { error: string }
  | { preview: ImportPreview }
  | { result: { imported: number; failed: number } }
  | Response;

const importTypes: { value: ImportType; label: string }[] = [
  { value: "members", label: "メンバー" },
  { value: "projects", label: "案件" },
  { value: "project_assignments", label: "案件アサイン" },
  { value: "member_monthly_capacities", label: "月次キャパシティ" },
  { value: "monthly_plans", label: "月次予定工数" },
];

export const loader = async ({ request }: { request: Request }) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    requireAdministrator(db, request);

    const url = new URL(request.url);
    const requestedType = url.searchParams.get("type") ?? "members";
    const typeParam = isImportType(requestedType) ? requestedType : "members";

    return {
      type: typeParam,
      jobs: listImportJobs(db),
    };
  } finally {
    sqlite.close();
  }
};

export const action = async ({ request }: Route.ActionArgs) => {
  const { db, sqlite } = createDatabaseConnection();

  try {
    const member = requireAdministrator(db, request);

    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "preview");
    const requestedType = String(formData.get("type") ?? "members");

    if (!isImportType(requestedType)) {
      return { error: "インポート種別が不正です。" };
    }

    const type = requestedType;

    if (intent === "template") {
      const template = getImportTemplate(type);
      return new Response(template, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kosu-${type}-template.csv"`,
        },
      });
    }

    if (intent === "export") {
      const csv = stringifyCsv(buildExportRows(db, type));
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kosu-${type}-export.csv"`,
        },
      });
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return { error: "ファイルを選択してください。" };
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (intent === "preview") {
      const preview = previewImport(db, type, rows);
      createImportJob(db, {
        importType: type,
        status: "previewed",
        fileName: file.name,
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        invalidRows: preview.invalidRows,
        createdByMemberId: member.id,
      });
      return { preview };
    }

    if (intent === "commit") {
      const defaultPassword = String(formData.get("defaultPassword") ?? "");

      if (type === "members" && defaultPassword.length < 8) {
        return { error: "新規メンバー作成用の初期パスワードを 8 文字以上で入力してください。" };
      }

      const result = await commitImport(db, type, rows, defaultPassword || undefined, member.id);
      createImportJob(db, {
        importType: type,
        status: result.failed === 0 ? "committed" : "failed",
        fileName: file.name,
        totalRows: result.imported + result.failed,
        validRows: result.imported,
        invalidRows: result.failed,
        resultSummary: JSON.stringify({ imported: result.imported, failed: result.failed }),
        createdByMemberId: member.id,
      });
      return { result };
    }

    return { error: "不明な操作です。" };
  } finally {
    sqlite.close();
  }
};

export const meta: Route.MetaFunction = () => [{ title: "データインポート | kosu" }];

function buildExportRows(db: ReturnType<typeof createDatabaseConnection>["db"], type: ImportType): string[][] {
  if (type === "members") {
    return [
      getImportTemplate(type).split(","),
      ...listMembers(db).map((member) => [
        member.email,
        member.displayName,
        member.role,
        member.departmentName ?? "",
        member.hourlyCostRate?.toString() ?? "",
        member.isActive ? "true" : "false",
      ]),
    ];
  }

  if (type === "projects") {
    return [
      getImportTemplate(type).split(","),
      ...listProjects(db).map((project) => [
        project.code,
        project.name,
        project.projectType,
        project.clientName ?? "",
        project.revenueOrBudgetAmount?.toString() ?? "",
        project.contractRevenueAmount?.toString() ?? "",
        project.laborCostBudgetAmount?.toString() ?? "",
      ]),
    ];
  }

  if (type === "project_assignments") {
    return [
      getImportTemplate(type).split(","),
      ...listMembers(db).flatMap((member) =>
        listAssignmentsByMember(db, member.id).map((assignment) => {
          const project = findProjectById(db, assignment.projectId);
          return [member.email, project?.code ?? assignment.projectId, assignment.assignmentRole ?? "", assignment.assignmentSource];
        }),
      ),
    ];
  }

  if (type === "member_monthly_capacities") {
    return [
      getImportTemplate(type).split(","),
      ...listMembers(db).flatMap((member) =>
        listCapacitiesByMember(db, member.id).map((capacity) => [
          member.email,
          capacity.month,
          capacity.capacityHours.toString(),
        ]),
      ),
    ];
  }

  return [
    getImportTemplate(type).split(","),
    ...listMembers(db).flatMap((member) =>
      listMonthlyPlansByMember(db, member.id).map((plan) => {
        const project = findProjectById(db, plan.projectId);
        return [member.email, project?.code ?? plan.projectId, plan.month, plan.assignmentRole, plan.plannedHours.toString()];
      }),
    ),
  ];
}

export default function Imports() {
  const { type, jobs } = useLoaderData<typeof loader>();
  const actionData = useActionData<ImportActionData>();
  const preview = actionData && "preview" in actionData ? actionData.preview : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">データインポート</h1>

      <Card>
        <CardHeader>
          <CardTitle>CSV アップロード</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionData && "error" in actionData ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {actionData.error}
            </p>
          ) : null}
          {actionData && "result" in actionData && actionData.result ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
              {actionData.result.imported} 件をインポートしました（失敗 {actionData.result.failed} 件）
            </p>
          ) : null}

          <Form className="space-y-4" encType="multipart/form-data" method="post">
            <div>
              <label className="text-sm font-medium text-slate-800">インポート種別</label>
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                name="type"
                defaultValue={type}
              >
                {importTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button formNoValidate name="intent" type="submit" value="template" variant="outline">
                テンプレート DL
              </Button>
              <Button className="ml-2" formNoValidate name="intent" type="submit" value="export" variant="outline">
                現在データをエクスポート
              </Button>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">CSV ファイル</label>
              <input
                className="mt-1 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium"
                name="file"
                type="file"
                accept=".csv"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">初期パスワード（メンバー新規作成時のみ）</label>
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                name="defaultPassword"
                type="password"
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex gap-2">
              <Button name="intent" type="submit" value="preview" variant="primary">
                プレビュー
              </Button>
              <Button name="intent" type="submit" value="commit" variant="outline">
                確定インポート
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>
              プレビュー: {importTypes.find((t) => t.value === preview.type)?.label}（有効 {preview.validRows} /{" "}
              {preview.totalRows} 件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">行</th>
                    <th className="py-2 pr-4">状態</th>
                    <th className="py-2 pr-4">値</th>
                    <th className="py-2">エラー</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row: { lineNumber: number; isValid: boolean; raw: string[]; errors: string[] }) => (
                    <tr key={row.lineNumber} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{row.lineNumber}</td>
                      <td className="py-2 pr-4">
                        {row.isValid ? <Badge tone="success">有効</Badge> : <Badge tone="danger">無効</Badge>}
                      </td>
                      <td className="py-2 pr-4">{row.raw.join(", ")}</td>
                      <td className="py-2 text-red-700">{row.errors.join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>インポート履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-600">履歴はありません。</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {jobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-slate-200 p-3">
                  {job.importType} · {job.status} · 有効 {job.validRows} / 合計 {job.totalRows}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
