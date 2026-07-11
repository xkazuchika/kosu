import type { KosuDatabase } from "~/db/client";
import {
  createMemberMonthlyCapacity,
  findCapacityByMemberAndMonth,
  updateMemberMonthlyCapacity,
} from "~/db/repositories/member-monthly-capacities";
import { createMember, findMemberByEmail, updateMember } from "~/db/repositories/members";
import { createMonthlyPlan, findMonthlyPlan, updateMonthlyPlan } from "~/db/repositories/monthly-plans";
import { createProjectAssignment, findActiveAssignment } from "~/db/repositories/project-assignments";
import { createProject, findProjectByCode, updateProject } from "~/db/repositories/projects";
import { parseOptionalYen } from "~/lib/currency";
import { hashPassword } from "~/lib/password";

export type ImportType = "members" | "projects" | "project_assignments" | "member_monthly_capacities" | "monthly_plans";

export type ImportPreviewRow = {
  lineNumber: number;
  raw: string[];
  isValid: boolean;
  errors: string[];
  parsed?: Record<string, string>;
};

export type ImportPreview = {
  type: ImportType;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
};

const templates: Record<ImportType, string[]> = {
  members: ["email", "displayName", "role", "departmentName", "hourlyCostRate", "isActive"],
  projects: ["code", "name", "projectType", "clientName", "revenueOrBudgetAmount", "contractRevenueAmount", "laborCostBudgetAmount"],
  project_assignments: ["memberEmail", "projectCode", "assignmentRole", "assignmentSource"],
  member_monthly_capacities: ["memberEmail", "month", "capacityHours"],
  monthly_plans: ["memberEmail", "projectCode", "month", "assignmentRole", "plannedHours"],
};

export function isImportType(value: string): value is ImportType {
  return Object.prototype.hasOwnProperty.call(templates, value);
}

export function getImportTemplate(type: ImportType): string {
  return templates[type].join(",");
}

export function previewImport(db: KosuDatabase, type: ImportType, rows: string[][]): ImportPreview {
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  const duplicateLineNumbers = collectDuplicateLineNumbers(type, headers, dataRows);
  const previewRows: ImportPreviewRow[] = [];
  let validCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const lineNumber = i + 2;
    const row = dataRows[i];
    const record: Record<string, string> = Object.fromEntries(headers.map((h, idx) => [h, row[idx] ?? ""]));
    const errors = validateRow(db, type, record);
    if (duplicateLineNumbers.has(lineNumber)) {
      errors.push("CSV 内でキーが重複しています");
    }
    const isValid = errors.length === 0;

    if (isValid) validCount++;

    previewRows.push({ lineNumber, raw: row, isValid, errors, parsed: isValid ? record : undefined });
  }

  return {
    type,
    totalRows: dataRows.length,
    validRows: validCount,
    invalidRows: dataRows.length - validCount,
    rows: previewRows,
  };
}

export async function commitImport(
  db: KosuDatabase,
  type: ImportType,
  rows: string[][],
  defaultPassword: string | undefined,
  createdByMemberId: string,
) {
  const preview = previewImport(db, type, rows);
  let imported = 0;
  let failed = preview.invalidRows;

  for (const row of preview.rows) {
    if (!row.parsed) {
      continue;
    }

    try {
      await applyRow(db, type, row.parsed, defaultPassword);
      imported++;
    } catch {
      failed++;
    }
  }

  return { imported, failed, createdByMemberId };
}

function collectDuplicateLineNumbers(type: ImportType, headers: string[], rows: string[][]) {
  const lineNumbersByKey = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const record: Record<string, string> = Object.fromEntries(headers.map((h, idx) => [h, rows[i][idx] ?? ""]));
    const key = duplicateKeyFor(type, record);

    if (!key) {
      continue;
    }

    lineNumbersByKey.set(key, [...(lineNumbersByKey.get(key) ?? []), i + 2]);
  }

  return new Set(
    [...lineNumbersByKey.values()].filter((lineNumbers) => lineNumbers.length > 1).flatMap((lineNumbers) => lineNumbers),
  );
}

function duplicateKeyFor(type: ImportType, record: Record<string, string>) {
  switch (type) {
    case "members":
      return normalizedKey(record.email);
    case "projects":
      return normalizedKey(record.code);
    case "project_assignments":
      return compositeRequiredKey([record.memberEmail, record.projectCode]);
    case "member_monthly_capacities":
      return compositeRequiredKey([record.memberEmail, record.month]);
    case "monthly_plans":
      return compositeRequiredKey([record.memberEmail, record.projectCode, record.month], record.assignmentRole ?? "");
  }
}

function normalizedKey(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function compositeRequiredKey(requiredValues: string[], optionalLastValue?: string) {
  const normalizedRequired = requiredValues.map((value) => value.trim().toLowerCase());

  if (normalizedRequired.some((value) => !value)) {
    return undefined;
  }

  return [...normalizedRequired, optionalLastValue?.trim().toLowerCase() ?? ""].join("|");
}

function validateRow(db: KosuDatabase, type: ImportType, record: Record<string, string>): string[] {
  const errors: string[] = [];

  switch (type) {
    case "members": {
      if (!record.email || !record.email.includes("@")) errors.push("メールアドレスが不正です");
      if (!record.displayName) errors.push("表示名が必要です");
      if (record.role && record.role !== "admin" && record.role !== "member") errors.push("ロールは admin または member です");
      if (record.hourlyCostRate && Number.isNaN(Number(record.hourlyCostRate))) errors.push("原価率は数値です");
      break;
    }
    case "projects": {
      if (!record.code) errors.push("案件コードが必要です");
      if (!record.name) errors.push("案件名が必要です");
      if (record.projectType && !["billable", "internal", "non_billable"].includes(record.projectType)) {
        errors.push("種別が不正です");
      }
      if (parseOptionalYen(record.revenueOrBudgetAmount) === undefined) errors.push("旧売上または予算は0以上の整数です");
      if (parseOptionalYen(record.contractRevenueAmount) === undefined) errors.push("契約売上は0以上の整数です");
      if (parseOptionalYen(record.laborCostBudgetAmount) === undefined) errors.push("人件費予算は0以上の整数です");
      break;
    }
    case "project_assignments": {
      if (!record.memberEmail) errors.push("メンバーメールが必要です");
      if (!record.projectCode) errors.push("案件コードが必要です");
      if (record.assignmentSource && record.assignmentSource !== "admin" && record.assignmentSource !== "self_assigned") {
        errors.push("アサイン元が不正です");
      }
      if (record.memberEmail && !findMemberByEmail(db, record.memberEmail)) errors.push("メンバーが存在しません");
      if (record.projectCode && !findProjectByCode(db, record.projectCode)) errors.push("案件が存在しません");
      break;
    }
    case "member_monthly_capacities": {
      if (!record.memberEmail) errors.push("メンバーメールが必要です");
      if (!/^\d{4}-\d{2}$/.test(record.month ?? "")) errors.push("月の形式は YYYY-MM です");
      if (Number.isNaN(Number(record.capacityHours))) errors.push("キャパシティは数値です");
      if (record.memberEmail && !findMemberByEmail(db, record.memberEmail)) errors.push("メンバーが存在しません");
      break;
    }
    case "monthly_plans": {
      if (!record.memberEmail) errors.push("メンバーメールが必要です");
      if (!record.projectCode) errors.push("案件コードが必要です");
      if (!/^\d{4}-\d{2}$/.test(record.month ?? "")) errors.push("月の形式は YYYY-MM です");
      if (Number.isNaN(Number(record.plannedHours))) errors.push("予定時間は数値です");
      if (record.memberEmail && !findMemberByEmail(db, record.memberEmail)) errors.push("メンバーが存在しません");
      if (record.projectCode && !findProjectByCode(db, record.projectCode)) errors.push("案件が存在しません");
      break;
    }
  }

  return errors;
}

async function applyRow(db: KosuDatabase, type: ImportType, record: Record<string, string>, defaultPassword: string | undefined) {
  switch (type) {
    case "members": {
      const existing = findMemberByEmail(db, record.email);
      const payload = {
        email: record.email,
        displayName: record.displayName,
        role: (record.role as "admin" | "member") || "member",
        departmentName: record.departmentName || null,
        hourlyCostRate: record.hourlyCostRate ? Number(record.hourlyCostRate) : null,
        isActive: record.isActive === "false" ? false : true,
      };
      if (existing) {
        updateMember(db, existing.id, payload);
      } else {
        if (!defaultPassword) {
          throw new Error("default password is required for new members");
        }

        const passwordHash = await hashPassword(defaultPassword);
        createMember(db, { ...payload, passwordHash });
      }
      break;
    }
    case "projects": {
      const existing = findProjectByCode(db, record.code);
      const legacyRevenueOrBudgetAmount = record.revenueOrBudgetAmount?.trim()
        ? parseOptionalYen(record.revenueOrBudgetAmount)
        : existing?.revenueOrBudgetAmount ?? null;
      const payload = {
        code: record.code,
        name: record.name,
        projectType: (record.projectType as "billable" | "internal" | "non_billable") || "internal",
        clientName: record.clientName || null,
        revenueOrBudgetAmount: legacyRevenueOrBudgetAmount,
        contractRevenueAmount: parseOptionalYen(record.contractRevenueAmount),
        laborCostBudgetAmount: parseOptionalYen(record.laborCostBudgetAmount),
      };
      if (existing) {
        updateProject(db, existing.id, payload);
      } else {
        createProject(db, payload);
      }
      break;
    }
    case "project_assignments": {
      const member = findMemberByEmail(db, record.memberEmail)!;
      const project = findProjectByCode(db, record.projectCode)!;
      const existing = findActiveAssignment(db, member.id, project.id);
      if (!existing) {
        createProjectAssignment(db, {
          memberId: member.id,
          projectId: project.id,
          assignmentRole: record.assignmentRole || null,
          assignmentSource: (record.assignmentSource as "admin" | "self_assigned") || "admin",
        });
      }
      break;
    }
    case "member_monthly_capacities": {
      const member = findMemberByEmail(db, record.memberEmail)!;
      const existing = findCapacityByMemberAndMonth(db, member.id, record.month);
      if (existing) {
        updateMemberMonthlyCapacity(db, existing.id, { capacityHours: Number(record.capacityHours) });
      } else {
        createMemberMonthlyCapacity(db, { memberId: member.id, month: record.month, capacityHours: Number(record.capacityHours) });
      }
      break;
    }
    case "monthly_plans": {
      const member = findMemberByEmail(db, record.memberEmail)!;
      const project = findProjectByCode(db, record.projectCode)!;
      const existing = findMonthlyPlan(db, member.id, project.id, record.month, record.assignmentRole || "");
      if (existing) {
        updateMonthlyPlan(db, existing.id, { plannedHours: Number(record.plannedHours) });
      } else {
        createMonthlyPlan(db, {
          memberId: member.id,
          projectId: project.id,
          month: record.month,
          assignmentRole: record.assignmentRole || "",
          plannedHours: Number(record.plannedHours),
          hourlyCostRateSnapshot: member.hourlyCostRate ?? null,
        });
      }
      break;
    }
  }
}
