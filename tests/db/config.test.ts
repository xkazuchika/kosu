// @vitest-environment node

import path from "node:path";

import { resolveDatabaseConfig } from "../../app/db/config";

test("database config uses documented data directory defaults", () => {
  const config = resolveDatabaseConfig({}, "/srv/kosu");

  expect(config.dataDir).toBe(path.resolve("/srv/kosu", "data"));
  expect(config.databasePath).toBe(path.resolve("/srv/kosu", "data", "kosu.sqlite"));
  expect(config.databaseUrl).toBe(path.resolve("/srv/kosu", "data", "kosu.sqlite"));
});

test("database config supports explicit data directory", () => {
  const config = resolveDatabaseConfig({ KOSU_DATA_DIR: "/var/lib/kosu" }, "/srv/kosu");

  expect(config.dataDir).toBe("/var/lib/kosu");
  expect(config.databasePath).toBe("/var/lib/kosu/kosu.sqlite");
});

test("database config resolves relative data directory from current working directory", () => {
  const config = resolveDatabaseConfig({ KOSU_DATA_DIR: "./tmp/kosu-data" }, "/srv/kosu");

  expect(config.dataDir).toBe(path.resolve("/srv/kosu", "tmp/kosu-data"));
});
