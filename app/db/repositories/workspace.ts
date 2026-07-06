import { desc, eq } from "drizzle-orm";

import type { KosuDatabase } from "../client";
import { workspaceSettings } from "../schema";

export const DEFAULT_WORKSPACE_ID = "default";

export type WorkspaceInsert = {
  displayName: string;
  defaultTimezone: string;
};

export type WorkspaceUpdate = Partial<WorkspaceInsert>;

export function findWorkspace(db: KosuDatabase) {
  return db.select().from(workspaceSettings).orderBy(desc(workspaceSettings.createdAt)).limit(1).get();
}

export function createWorkspace(db: KosuDatabase, input: WorkspaceInsert) {
  return db
    .insert(workspaceSettings)
    .values({
      id: DEFAULT_WORKSPACE_ID,
      displayName: input.displayName,
      defaultTimezone: input.defaultTimezone,
    })
    .returning()
    .get();
}

export function updateWorkspace(db: KosuDatabase, id: string, input: WorkspaceUpdate) {
  return db
    .update(workspaceSettings)
    .set({
      displayName: input.displayName,
      defaultTimezone: input.defaultTimezone,
    })
    .where(eq(workspaceSettings.id, id))
    .returning()
    .get();
}
