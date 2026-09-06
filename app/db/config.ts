import path from "node:path";

export type DatabaseConfig = {
  dataDir: string;
  databasePath: string;
  databaseUrl: string;
};

type DatabaseEnv = {
  KOSU_DATA_DIR?: string;
};

const databaseFileName = "kosu.sqlite";

export function resolveDatabaseConfig(
  env: DatabaseEnv = process.env,
  cwd = process.cwd(),
): DatabaseConfig {
  const configuredDataDir = env.KOSU_DATA_DIR?.trim() || "data";
  const dataDir = path.resolve(cwd, configuredDataDir);
  const databasePath = path.join(dataDir, databaseFileName);

  return {
    dataDir,
    databasePath,
    databaseUrl: databasePath,
  };
}

export const databaseConfig = resolveDatabaseConfig();

export const defaultBusyTimeoutMs = 5000;

type SqliteEnv = {
  KOSU_SQLITE_BUSY_TIMEOUT_MS?: string;
};

export function resolveBusyTimeoutMs(env: SqliteEnv = process.env): number {
  const raw = env.KOSU_SQLITE_BUSY_TIMEOUT_MS?.trim();

  if (!raw) {
    return defaultBusyTimeoutMs;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return defaultBusyTimeoutMs;
  }

  return parsed;
}

export const migrationsFolder = path.resolve(process.cwd(), "./drizzle");
