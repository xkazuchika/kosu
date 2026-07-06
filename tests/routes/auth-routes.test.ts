// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { action as loginAction } from "../../app/routes/login";
import { action as logoutAction } from "../../app/routes/logout";
import { action as setupAction, loader as setupLoader } from "../../app/routes/setup";
import { loader as appLayoutLoader } from "../../app/routes/app-layout";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-auth-routes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

function buildRequest(formData: FormData, cookie = "") {
  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function buildContext() {
  return new Map<string, unknown>() as unknown as AppLoadContext;
}

describe("auth routes", () => {
  test("setup loader redirects to login when setup is complete", async () => {
    const formData = new FormData();
    formData.append("workspaceName", "Acme");
    formData.append("defaultTimezone", "Asia/Tokyo");
    formData.append("administratorName", "Admin");
    formData.append("administratorEmail", "admin@example.com");
    formData.append("administratorPassword", "password123");

    await (setupAction as unknown as RouteActionHandler)({
      request: buildRequest(formData),
      params: {},
      context: buildContext(),
    });

    const response = await (setupLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/"),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/login");
  });

  test("setup action redirects to login when setup is already complete", async () => {
    const formData = new FormData();
    formData.append("workspaceName", "Acme");
    formData.append("defaultTimezone", "Asia/Tokyo");
    formData.append("administratorName", "Admin");
    formData.append("administratorEmail", "admin@example.com");
    formData.append("administratorPassword", "password123");

    await (setupAction as unknown as RouteActionHandler)({
      request: buildRequest(formData),
      params: {},
      context: buildContext(),
    });

    const secondFormData = new FormData();
    secondFormData.append("workspaceName", "Acme2");
    secondFormData.append("defaultTimezone", "Asia/Tokyo");
    secondFormData.append("administratorName", "Admin2");
    secondFormData.append("administratorEmail", "admin2@example.com");
    secondFormData.append("administratorPassword", "password123");

    const response = await (setupAction as unknown as RouteActionHandler)({
      request: buildRequest(secondFormData),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe("/login");
  });

  test("login succeeds with valid credentials and sets session cookie", async () => {
    const setupForm = new FormData();
    setupForm.append("workspaceName", "Acme");
    setupForm.append("defaultTimezone", "Asia/Tokyo");
    setupForm.append("administratorName", "Admin");
    setupForm.append("administratorEmail", "admin@example.com");
    setupForm.append("administratorPassword", "password123");

    await (setupAction as unknown as RouteActionHandler)({
      request: buildRequest(setupForm),
      params: {},
      context: buildContext(),
    });

    const loginForm = new FormData();
    loginForm.append("email", "admin@example.com");
    loginForm.append("password", "password123");

    const response = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(loginForm),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/dashboard");
    expect((response as Response).headers.get("Set-Cookie")).toContain("kosu_session=");
  });

  test("login fails with invalid password", async () => {
    const setupForm = new FormData();
    setupForm.append("workspaceName", "Acme");
    setupForm.append("defaultTimezone", "Asia/Tokyo");
    setupForm.append("administratorName", "Admin");
    setupForm.append("administratorEmail", "admin@example.com");
    setupForm.append("administratorPassword", "password123");

    await (setupAction as unknown as RouteActionHandler)({
      request: buildRequest(setupForm),
      params: {},
      context: buildContext(),
    });

    const loginForm = new FormData();
    loginForm.append("email", "admin@example.com");
    loginForm.append("password", "wrong");

    const response = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(loginForm),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Object);
    expect((response as { error: string }).error).toBe("メールアドレスまたはパスワードが正しくありません。");
  });

  test("authenticated app layout redirects unauthenticated users to login", async () => {
    const response = await (appLayoutLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/"),
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/login");
  });

  test("logout clears session cookie", async () => {
    const response = await (logoutAction as unknown as RouteActionHandler)({
      request: new Request("http://localhost/"),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/login");
    expect((response as Response).headers.get("Set-Cookie")).toContain("kosu_session=;");
  });
});

type AppLoadContext = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

type RouteActionHandler = (args: { request: Request; params: Record<string, string | undefined>; context: AppLoadContext }) => Promise<unknown>;
type RouteLoaderHandler = (args: { request: Request; params?: Record<string, string | undefined>; context: AppLoadContext }) => Promise<unknown>;
