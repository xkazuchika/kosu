import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { resolveDatabaseConfig, migrationsFolder } from "./config";
import { schema } from "./schema";

export type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export type KosuDatabase = DatabaseConnection["db"];

export function createDatabaseConnection(databaseUrl?: string) {
  const url = databaseUrl ?? resolveDatabaseConfig().databaseUrl;
  mkdirSync(path.dirname(url), { recursive: true });
  const sqlite = new Database(url);
  const db = drizzle({ client: sqlite, schema });

  return { db, sqlite };
}

export function runMigrations(connection: DatabaseConnection) {
  migrate(connection.db, { migrationsFolder });
}

export function runMigrationsAndClose(databaseUrl?: string) {
  const connection = createDatabaseConnection(databaseUrl);

  try {
    runMigrations(connection);
  } finally {
    connection.sqlite.close();
  }
}
