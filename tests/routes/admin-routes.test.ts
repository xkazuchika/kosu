// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { members } from "../../app/db/schema";
import { action as settingsAction, loader as settingsLoader } from "../../app/routes/settings";
import { loader as membersLoader } from "../../app/routes/members";
import { action as setupAction } from "../../app/routes/setup";
import { action as loginAction } from "../../app/routes/login";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-admin-routes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function buildContext() {
  return new Map<string, unknown>() as unknown as AppLoadContext;
}

function buildRequest(formData: FormData, cookie = "") {
  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

async function setupAndLogin(password: string, role: "admin" | "member" = "admin") {
  const setupForm = new FormData();
  setupForm.append("workspaceName", "Acme");
  setupForm.append("defaultTimezone", "Asia/Tokyo");
  setupForm.append("administratorName", "Admin");
  setupForm.append("administratorEmail", "admin@example.com");
  setupForm.append("administratorPassword", password);

  await (setupAction as unknown as RouteActionHandler)({
    request: buildRequest(setupForm),
    params: {},
    context: buildContext(),
  });

  const loginForm = new FormData();
  loginForm.append("email", "admin@example.com");
  loginForm.append("password", password);

  const response = await (loginAction as unknown as RouteActionHandler)({
    request: buildRequest(loginForm),
    params: {},
    context: buildContext(),
  });

  const setCookie = (response as Response).headers.get("Set-Cookie");
  const match = setCookie?.match(/kosu_session=([^;]+)/);
  const sessionCookie = match ? `kosu_session=${match[1]}` : "";

  if (role === "member") {
    const db = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    db.db.update(members).set({ role: "member" }).where(eq(members.email, "admin@example.com")).run();
    db.sqlite.close();
  }

  return sessionCookie;
}

beforeEach(() => {
  dataDir = tempDataDir();
  mkdirSync(dataDir, { recursive: true });
  originalDataDir = process.env.KOSU_DATA_DIR;
  process.env.KOSU_DATA_DIR = dataDir;

  const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
  runMigrations(connection);
  connection.sqlite.close();
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

describe("admin routes authorization", () => {
  test("settings loader allows admin", async () => {
    const cookie = await setupAndLogin("password123");
    const response = await (settingsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Object);
    expect((response as { workspace: { displayName: string } }).workspace.displayName).toBe("Acme");
  });

  test("settings loader rejects non-admin", async () => {
    const cookie = await setupAndLogin("password123", "member");
    await expect(
      (settingsLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
        params: {},
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  test("settings action updates workspace", async () => {
    const cookie = await setupAndLogin("password123");
    const formData = new FormData();
    formData.append("displayName", "Acme Updated");
    formData.append("defaultTimezone", "UTC");

    const response = await (settingsAction as unknown as RouteActionHandler)({
      request: buildRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/settings");
  });

  test("members loader allows admin", async () => {
    const cookie = await setupAndLogin("password123");
    const response = await (membersLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Object);
    expect((response as { members: unknown[] }).members.length).toBeGreaterThan(0);
  });

  test("members loader rejects non-admin", async () => {
    const cookie = await setupAndLogin("password123", "member");
    await expect(
      (membersLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/", { headers: { Cookie: cookie } }),
        params: {},
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });
});

type AppLoadContext = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

type RouteActionHandler = (args: { request: Request; params: Record<string, string | undefined>; context: AppLoadContext }) => Promise<unknown>;
type RouteLoaderHandler = (args: { request: Request; params?: Record<string, string | undefined>; context: AppLoadContext }) => Promise<unknown>;
