import type { DatabaseConnection } from "./client";

export type ForeignKeyViolation = {
  table: string;
  parentTable: string;
  count: number;
};

type ForeignKeyCheckRow = {
  table: string;
  rowid: number | string | null;
  parent: string;
  fkid: number;
};

export function findForeignKeyViolations(
  connection: DatabaseConnection,
): ForeignKeyViolation[] {
  const rows = connection.sqlite.pragma(
    "foreign_key_check",
  ) as ForeignKeyCheckRow[];
  const totals = new Map<string, ForeignKeyViolation>();

  for (const row of rows) {
    const key = `${row.table}->${row.parent}`;
    const existing = totals.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    totals.set(key, { table: row.table, parentTable: row.parent, count: 1 });
  }

  return [...totals.values()].sort(
    (a, b) =>
      a.table.localeCompare(b.table) ||
      a.parentTable.localeCompare(b.parentTable),
  );
}

export function formatForeignKeyViolations(
  violations: ForeignKeyViolation[],
): string {
  const detail = violations.map(
    (violation) =>
      `  - ${violation.table} -> ${violation.parentTable}: ${violation.count} 件`,
  );

  return [
    "外部キー制約に違反するデータが見つかりました。",
    ...detail,
    "",
    "アプリケーションの起動を中止しました。バックアップからリストアするか、",
    "以下のコマンドで対象行を特定して修復してください。",
    "",
    '  sqlite3 <データベースファイル> "PRAGMA foreign_key_check"',
    '  sqlite3 <データベースファイル> ".mode list" "PRAGMA foreign_key_list(<テーブル名>)"',
  ].join("\n");
}
