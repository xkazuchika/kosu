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

export function resolveDatabaseConfig(env: DatabaseEnv = process.env, cwd = process.cwd()): DatabaseConfig {
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

export const migrationsFolder = path.resolve(process.cwd(), "./drizzle");

