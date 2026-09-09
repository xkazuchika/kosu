import type { KosuDatabase } from "~/db/client";
import {
  createMemberMonthlyCapacity,
  findCapacityByMemberAndMonth,
  updateMemberMonthlyCapacity,
} from "~/db/repositories/member-monthly-capacities";
import {
  createMember,
  findMemberByEmail,
  updateMember,
} from "~/db/repositories/members";
import {
  createMonthlyPlan,
  findMonthlyPlan,
  updateMonthlyPlan,
} from "~/db/repositories/monthly-plans";
import { findActiveAssignment } from "~/db/repositories/project-assignments";
import {
  createProject,
  findProjectByCode,
  updateProject,
} from "~/db/repositories/projects";
import { parseOptionalHourlyCostRate, parseOptionalYen } from "~/lib/currency";
import { hashPassword } from "~/lib/password";
import {
  isNonNegativeQuarterHour,
  isValidMonth,
  parseOptionalQuarterHours,
} from "~/lib/time";
import { requireOpenMonth } from "~/services/monthly-cost-close";
import {
  createValidatedProjectAssignment,
  ProjectAssignmentError,
  validateNewProjectAssignment,
} from "~/services/project-assignment";

export type ImportType =
  | "members"
  | "projects"
  | "project_assignments"
  | "member_monthly_capacities"
  | "monthly_plans";

export type ImportPreviewRow = {
  lineNumber: number;
  raw: string[];
  isValid: boolean;
  errors: string[];
  parsed?: Record<string, string>;
};

export type ImportPreview = {
  type: ImportType;
  missingColumns: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
};

const templates: Record<ImportType, string[]> = {
  members: [
    "email",
    "displayName",
    "role",
    "departmentName",
    "hourlyCostRate",
    "isActive",
  ],
  projects: [
    "code",
    "name",
    "projectType",
    "clientName",
    "revenueOrBudgetAmount",
    "contractRevenueAmount",
    "laborCostBudgetAmount",
    "effortBudgetHours",
  ],
  project_assignments: [
    "memberEmail",
    "projectCode",
    "assignmentRole",
    "assignmentSource",
  ],
  member_monthly_capacities: ["memberEmail", "month", "capacityHours"],
  monthly_plans: [
    "memberEmail",
    "projectCode",
    "month",
    "assignmentRole",
    "plannedHours",
  ],
};

const requiredColumns: Record<ImportType, string[]> = {
  members: ["email", "displayName"],
  projects: ["code", "name"],
  project_assignments: ["memberEmail", "projectCode"],
  member_monthly_capacities: ["memberEmail", "month", "capacityHours"],
  monthly_plans: ["memberEmail", "projectCode", "month", "plannedHours"],
};

export function isImportType(value: string): value is ImportType {
  return Object.prototype.hasOwnProperty.call(templates, value);
}

export function getImportTemplate(type: ImportType): string {
  return templates[type].join(",");
}

export function findMissingColumns(
  type: ImportType,
  headers: string[],
): string[] {
  const present = new Set(headers.map((header) => header.trim()));

  return requiredColumns[type].filter((column) => !present.has(column));
}

export function previewImport(
  db: KosuDatabase,
  type: ImportType,
  rows: string[][],
): ImportPreview {
  const headers = rows[0] ?? [];
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  const missingColumns = findMissingColumns(type, headers);
  const duplicateLineNumbers = collectDuplicateLineNumbers(
    type,
    headers,
    dataRows,
  );
  const previewRows: ImportPreviewRow[] = [];
  let validCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const lineNumber = i + 2;
    const row = dataRows[i];
    const record: Record<string, string> = Object.fromEntries(
      headers.map((h, idx) => [h, row[idx] ?? ""]),
    );
    const errors =
      missingColumns.length > 0
        ? missingColumns.map(
            (column) => `必須列「${column}」が CSV に存在しません`,
          )
        : validateRow(db, type, record);

    if (missingColumns.length === 0 && duplicateLineNumbers.has(lineNumber)) {
      errors.push("CSV 内でキーが重複しています");
    }

    const isValid = errors.length === 0;

    if (isValid) validCount++;

    previewRows.push({
      lineNumber,
      raw: row,
      isValid,
      errors,
      parsed: isValid ? record : undefined,
    });
  }

  return {
    type,
    missingColumns,
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
  if (type === "member_monthly_capacities" || type === "monthly_plans") {
    const months = new Set(
      preview.rows
        .map((row) => row.parsed?.month)
        .filter((month): month is string => Boolean(month)),
    );

    for (const month of months) {
      requireOpenMonth(db, month);
    }
  }

  const applicableRows = preview.rows.filter((row) => Boolean(row.parsed));

  if (preview.invalidRows > 0 || applicableRows.length === 0) {
    return { imported: 0, failed: preview.totalRows, createdByMemberId };
  }

  const defaultPasswordHash =
    type === "members" && defaultPassword
      ? await hashPassword(defaultPassword)
      : undefined;
  const importedCount = applicableRows.length;

  try {
    db.transaction((transaction) => {
      const tx = transaction as unknown as KosuDatabase;

      if (type === "member_monthly_capacities" || type === "monthly_plans") {
        const months = new Set(
          applicableRows.map((row) => row.parsed!.month).filter(Boolean),
        );
        for (const month of months) requireOpenMonth(tx, month);
      }

      for (const row of applicableRows) {
        if (validateRow(tx, type, row.parsed!).length > 0) {
          throw new Error(`line ${row.lineNumber} is no longer valid`);
        }
      }

      for (const row of applicableRows) {
        applyRow(tx, type, row.parsed!, defaultPasswordHash);
      }
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    return { imported: 0, failed: importedCount, createdByMemberId };
  }

  return { imported: importedCount, failed: 0, createdByMemberId };
}

function collectDuplicateLineNumbers(
  type: ImportType,
  headers: string[],
  rows: string[][],
) {
  const lineNumbersByKey = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const record: Record<string, string> = Object.fromEntries(
      headers.map((h, idx) => [h, rows[i][idx] ?? ""]),
    );
    const key = duplicateKeyFor(type, record);

    if (!key) {
      continue;
    }

    lineNumbersByKey.set(key, [...(lineNumbersByKey.get(key) ?? []), i + 2]);
  }

  return new Set(
    [...lineNumbersByKey.values()]
      .filter((lineNumbers) => lineNumbers.length > 1)
      .flatMap((lineNumbers) => lineNumbers),
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
      return compositeRequiredKey(
        [record.memberEmail, record.projectCode, record.month],
        record.assignmentRole ?? "",
      );
  }
}

function normalizedKey(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function compositeRequiredKey(
  requiredValues: string[],
  optionalLastValue?: string,
) {
  const normalizedRequired = requiredValues.map((value) =>
    value.trim().toLowerCase(),
  );

  if (normalizedRequired.some((value) => !value)) {
    return undefined;
  }

  return [
    ...normalizedRequired,
    optionalLastValue?.trim().toLowerCase() ?? "",
  ].join("|");
}

function validateRow(
  db: KosuDatabase,
  type: ImportType,
  record: Record<string, string>,
): string[] {
  const errors: string[] = [];

  switch (type) {
    case "members": {
      if (!record.email || !record.email.includes("@"))
        errors.push("メールアドレスが不正です");
      if (!record.displayName) errors.push("表示名が必要です");
      if (record.role && record.role !== "admin" && record.role !== "member")
        errors.push("ロールは admin または member です");
      if (parseOptionalHourlyCostRate(record.hourlyCostRate) === undefined) {
        errors.push("時間あたり原価は0以上の整数です");
      }
      if (parseOptionalBoolean(record.isActive) === undefined) {
        errors.push("有効フラグは true または false です");
      }
      break;
    }
    case "projects": {
      if (!record.code) errors.push("案件コードが必要です");
      if (!record.name) errors.push("案件名が必要です");
      if (
        record.projectType &&
        !["billable", "internal", "non_billable"].includes(record.projectType)
      ) {
        errors.push("種別が不正です");
      }
      if (parseOptionalYen(record.revenueOrBudgetAmount) === undefined)
        errors.push("旧売上または予算は0以上の整数です");
      if (parseOptionalYen(record.contractRevenueAmount) === undefined)
        errors.push("契約売上は0以上の整数です");
      if (parseOptionalYen(record.laborCostBudgetAmount) === undefined)
        errors.push("人件費予算は0以上の整数です");
      if (parseOptionalQuarterHours(record.effortBudgetHours) === undefined) {
        errors.push("工数予算は0.25h単位の0以上の値です");
      }
      break;
    }
    case "project_assignments": {
      if (!record.memberEmail) errors.push("メンバーメールが必要です");
      if (!record.projectCode) errors.push("案件コードが必要です");
      if (
        record.assignmentSource &&
        record.assignmentSource !== "admin" &&
        record.assignmentSource !== "self_assigned"
      ) {
        errors.push("アサイン元が不正です");
      }
      const member = record.memberEmail
        ? findMemberByEmail(db, record.memberEmail)
        : undefined;
      const project = record.projectCode
        ? findProjectByCode(db, record.projectCode)
        : undefined;
      if (record.memberEmail && !member) errors.push("メンバーが存在しません");
      if (record.projectCode && !project) errors.push("案件が存在しません");
      if (member && project) {
        try {
          validateNewProjectAssignment(db, member.id, project.id);
        } catch (error) {
          if (error instanceof ProjectAssignmentError)
            errors.push(error.message);
          else throw error;
        }
      }
      break;
    }
    case "member_monthly_capacities": {
      if (!record.memberEmail) errors.push("メンバーメールが必要です");
      if (!isValidMonth(record.month ?? ""))
        errors.push("月の形式は YYYY-MM で実在する月にしてください");
      if (!record.capacityHours?.trim()) {
        errors.push("キャパシティを入力してください");
      } else if (!isNonNegativeQuarterHour(Number(record.capacityHours))) {
        errors.push("キャパシティは 0.25h 単位の 0 以上の値です");
      }
      const member = record.memberEmail
        ? findMemberByEmail(db, record.memberEmail)
        : undefined;
      if (record.memberEmail && !member) errors.push("メンバーが存在しません");
      if (member && !member.isActive) errors.push("メンバーが無効です");
      break;
    }
    case "monthly_plans": {
      if (!record.memberEmail) errors.push("メンバーメールが必要です");
      if (!record.projectCode) errors.push("案件コードが必要です");
      if (!isValidMonth(record.month ?? ""))
        errors.push("月の形式は YYYY-MM で実在する月にしてください");
      if (!record.plannedHours?.trim()) {
        errors.push("予定時間を入力してください");
      } else if (!isNonNegativeQuarterHour(Number(record.plannedHours))) {
        errors.push("予定時間は 0.25h 単位の 0 以上の値です");
      }
      const member = record.memberEmail
        ? findMemberByEmail(db, record.memberEmail)
        : undefined;
      const project = record.projectCode
        ? findProjectByCode(db, record.projectCode)
        : undefined;
      if (record.memberEmail && !member) errors.push("メンバーが存在しません");
      if (record.projectCode && !project) errors.push("案件が存在しません");
      if (member && !member.isActive) errors.push("メンバーが無効です");
      if (project && project.isArchived)
        errors.push("案件がアーカイブ済みです");
      if (
        member &&
        project &&
        !findActiveAssignment(db, member.id, project.id)
      ) {
        errors.push("メンバーが案件にアサインされていません");
      }
      break;
    }
  }

  return errors;
}

function applyRow(
  db: KosuDatabase,
  type: ImportType,
  record: Record<string, string>,
  defaultPasswordHash: string | undefined,
) {
  switch (type) {
    case "members": {
      const existing = findMemberByEmail(db, record.email);
      const payload = {
        email: record.email,
        displayName: record.displayName,
        role: (record.role as "admin" | "member") || "member",
        departmentName: record.departmentName || null,
        hourlyCostRate: parseOptionalHourlyCostRate(record.hourlyCostRate),
        isActive: parseOptionalBoolean(record.isActive) ?? true,
      };
      if (existing) {
        updateMember(db, existing.id, payload);
      } else {
        if (!defaultPasswordHash) {
          throw new Error("default password hash is required for new members");
        }

        createMember(db, { ...payload, passwordHash: defaultPasswordHash });
      }
      break;
    }
    case "projects": {
      const existing = findProjectByCode(db, record.code);
      const legacyRevenueOrBudgetAmount = record.revenueOrBudgetAmount?.trim()
        ? parseOptionalYen(record.revenueOrBudgetAmount)
        : (existing?.revenueOrBudgetAmount ?? null);
      const effortBudgetHours = Object.prototype.hasOwnProperty.call(
        record,
        "effortBudgetHours",
      )
        ? parseOptionalQuarterHours(record.effortBudgetHours)
        : (existing?.effortBudgetHours ?? null);
      const payload = {
        code: record.code,
        name: record.name,
        projectType:
          (record.projectType as "billable" | "internal" | "non_billable") ||
          "internal",
        clientName: record.clientName || null,
        revenueOrBudgetAmount: legacyRevenueOrBudgetAmount,
        contractRevenueAmount: parseOptionalYen(record.contractRevenueAmount),
        laborCostBudgetAmount: parseOptionalYen(record.laborCostBudgetAmount),
        effortBudgetHours,
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
      createValidatedProjectAssignment(db, {
        memberId: member.id,
        projectId: project.id,
        assignmentRole: record.assignmentRole || null,
        assignmentSource:
          (record.assignmentSource as "admin" | "self_assigned") || "admin",
      });
      break;
    }
    case "member_monthly_capacities": {
      const member = findMemberByEmail(db, record.memberEmail)!;
      const existing = findCapacityByMemberAndMonth(
        db,
        member.id,
        record.month,
      );
      if (existing) {
        updateMemberMonthlyCapacity(db, existing.id, {
          capacityHours: Number(record.capacityHours),
        });
      } else {
        createMemberMonthlyCapacity(db, {
          memberId: member.id,
          month: record.month,
          capacityHours: Number(record.capacityHours),
        });
      }
      break;
    }
    case "monthly_plans": {
      const member = findMemberByEmail(db, record.memberEmail)!;
      const project = findProjectByCode(db, record.projectCode)!;
      const existing = findMonthlyPlan(
        db,
        member.id,
        project.id,
        record.month,
        record.assignmentRole || "",
      );
      if (existing) {
        updateMonthlyPlan(db, existing.id, {
          plannedHours: Number(record.plannedHours),
        });
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

function parseOptionalBoolean(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}
