import { asc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { importJobs } from "../schema";

export type ImportType = "members" | "projects" | "project_assignments" | "member_monthly_capacities" | "monthly_plans";
export type ImportStatus = "previewed" | "committed" | "failed";

export type ImportJobInsert = {
  importType: ImportType;
  status: ImportStatus;
  fileName?: string | null;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  resultSummary?: string | null;
  createdByMemberId?: string | null;
};

export function listImportJobs(db: KosuDatabase) {
  return db.select().from(importJobs).orderBy(asc(importJobs.createdAt)).all();
}

export function findImportJobById(db: KosuDatabase, id: string) {
  return db.select().from(importJobs).where(eq(importJobs.id, id)).get();
}

export function createImportJob(db: KosuDatabase, input: ImportJobInsert) {
  return db
    .insert(importJobs)
    .values({
      id: createId(),
      importType: input.importType,
      status: input.status,
      fileName: input.fileName ?? null,
      totalRows: input.totalRows ?? 0,
      validRows: input.validRows ?? 0,
      invalidRows: input.invalidRows ?? 0,
      resultSummary: input.resultSummary ?? null,
      createdByMemberId: input.createdByMemberId ?? null,
    })
    .returning()
    .get();
}

export function commitImportJob(db: KosuDatabase, id: string, committedAt: string) {
  return db
    .update(importJobs)
    .set({ status: "committed", committedAt })
    .where(eq(importJobs.id, id))
    .returning()
    .get();
}
