// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import routeConfig from "../../app/routes";
import { loader as healthLoader } from "../../app/routes/health";

type HealthResult = {
  status: "ok" | "error";
  database: boolean;
};

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(
    os.tmpdir(),
    `kosu-health-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
}

beforeEach(() => {
  dataDir = tempDataDir();
  mkdirSync(dataDir, { recursive: true });
  originalDataDir = process.env.KOSU_DATA_DIR;
  process.env.KOSU_DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir !== undefined) {
    process.env.KOSU_DATA_DIR = originalDataDir;
  } else {
    delete process.env.KOSU_DATA_DIR;
  }

  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

function migrateCurrentDataDir() {
  const connection = createDatabaseConnection();
  runMigrations(connection);
  connection.sqlite.close();
}

describe("health endpoint", () => {
  test("returns 200 without authentication when the database is usable", async () => {
    migrateCurrentDataDir();

    const response = await healthLoader();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: true });
  });

  test("returns 503 when the database connection is not usable", async () => {
    mkdirSync(path.join(dataDir, "kosu.sqlite"));

    const response = await healthLoader();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error", database: false });
  });

  test("exposes only availability state and no member, project, or financial data", async () => {
    migrateCurrentDataDir();

    const response = await healthLoader();
    const body = (await response.json()) as HealthResult;

    expect(Object.keys(body).sort()).toEqual(["database", "status"]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("hourlyCostRate");
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("contractRevenueAmount");
    expect(serialized).not.toContain("example.com");
  });
});

type RouteConfigEntry = {
  path?: string;
  file?: string;
  children?: RouteConfigEntry[];
};

describe("health route registration", () => {
  test("registers the health path in the route config", () => {
    const entries = routeConfig as unknown as RouteConfigEntry[];
    const healthEntry = entries.find((entry) => entry.path === "health");

    expect(healthEntry).toBeDefined();
    expect(healthEntry?.file).toBe("routes/health.ts");
  });

  test("keeps the health path outside the authenticated app layout", () => {
    const entries = routeConfig as unknown as RouteConfigEntry[];
    const nestedInLayout = entries.some((entry) =>
      (entry.children ?? []).some((child) => child.path === "health"),
    );

    expect(nestedInLayout).toBe(false);
  });
});
