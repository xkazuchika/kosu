// @vitest-environment node

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { members } from "../../app/db/schema";
import { action as loginAction } from "../../app/routes/login";
import { action as setupAction } from "../../app/routes/setup";
import { eq } from "drizzle-orm";

export type AppLoadContext = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

export type RouteActionHandler = (args: {
  request: Request;
  params: Record<string, string | undefined>;
  context: AppLoadContext;
}) => Promise<unknown>;

export type RouteLoaderHandler = (args: {
  request: Request;
  params?: Record<string, string | undefined>;
  context: AppLoadContext;
}) => Promise<unknown>;

export function buildContext() {
  return new Map<string, unknown>() as unknown as AppLoadContext;
}

export function buildRequest(formData: FormData, cookie = "") {
  return new Request("http://localhost/", {
    method: "POST",
    body: formData,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

export async function setupAndLogin(dataDir: string, password: string, role: "admin" | "member" = "admin") {
  process.env.KOSU_DATA_DIR = dataDir;
  const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
  runMigrations(connection);
  connection.sqlite.close();

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
