// @vitest-environment node

import { createDatabaseConnection, runMigrations } from "../../app/db/client";

export function createTestDatabase() {
  const connection = createDatabaseConnection(":memory:");
  runMigrations(connection);
  return connection;
}
