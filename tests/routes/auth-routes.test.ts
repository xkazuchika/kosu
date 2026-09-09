// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { members, sessions } from "../../app/db/schema";
import { action as loginAction } from "../../app/routes/login";
import { action as logoutAction } from "../../app/routes/logout";
import { action as profileAction } from "../../app/routes/profile";
import {
  action as setupAction,
  loader as setupLoader,
} from "../../app/routes/setup";
import {
  action as memberDetailAction,
  loader as memberDetailLoader,
} from "../../app/routes/members.$id";
import { action as newMemberAction } from "../../app/routes/members.new";
import { loader as appLayoutLoader } from "../../app/routes/app-layout";
import { resetLoginRateLimiter } from "../../app/services/login-rate-limit";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(
    os.tmpdir(),
    `kosu-auth-routes-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
}

beforeEach(() => {
  dataDir = tempDataDir();
  mkdirSync(dataDir, { recursive: true });
  originalDataDir = process.env.KOSU_DATA_DIR;
  process.env.KOSU_DATA_DIR = dataDir;
  resetLoginRateLimiter();

  const connection = createDatabaseConnection(
    resolveDatabaseConfig().databaseUrl,
  );
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
    expect((response as Response).headers.get("Set-Cookie")).toContain(
      "kosu_session=",
    );
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
    expect((response as { error: string }).error).toBe(
      "メールアドレスまたはパスワードが正しくありません。",
    );
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
    expect((response as Response).headers.get("Set-Cookie")).toContain(
      "kosu_session=;",
    );
  });

  test("login is throttled after repeated failures and returns 429", async () => {
    await setupAndLoginAdmin("password123");

    process.env.KOSU_LOGIN_RATE_LIMIT_MAX = "2";

    const loginForm = () => {
      const formData = new FormData();
      formData.append("email", "admin@example.com");
      formData.append("password", "wrong");
      return formData;
    };

    const first = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(loginForm()),
      params: {},
      context: buildContext(),
    });
    expect((first as { error?: string }).error).toBeDefined();

    const second = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(loginForm()),
      params: {},
      context: buildContext(),
    });
    expect((second as { error?: string }).error).toBeDefined();

    const third = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(loginForm()),
      params: {},
      context: buildContext(),
    });
    expect(third).toBeInstanceOf(Response);
    expect((third as Response).status).toBe(429);

    const validForm = new FormData();
    validForm.append("email", "admin@example.com");
    validForm.append("password", "password123");

    const validAttempt = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(validForm),
      params: {},
      context: buildContext(),
    });
    expect(validAttempt).toBeInstanceOf(Response);
    expect((validAttempt as Response).status).toBe(429);

    delete process.env.KOSU_LOGIN_RATE_LIMIT_MAX;
  });

  test("profile password change keeps current session and removes other sessions", async () => {
    const cookie = await setupAndLoginAdmin("password123");
    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );
    const memberId = connection.db
      .select()
      .from(members)
      .where(eq(members.email, "admin@example.com"))
      .get()!.id;

    const otherSessionForm = new FormData();
    otherSessionForm.append("email", "admin@example.com");
    otherSessionForm.append("password", "password123");
    await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(otherSessionForm),
      params: {},
      context: buildContext(),
    });

    const before = connection.db
      .select()
      .from(sessions)
      .where(eq(sessions.memberId, memberId))
      .all();
    expect(before.length).toBe(3);

    const form = new FormData();
    form.append("displayName", "Admin");
    form.append("password", "newpassword123");

    const response = await (profileAction as unknown as RouteActionHandler)({
      request: buildRequest(form, cookie),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);

    const after = connection.db
      .select()
      .from(sessions)
      .where(eq(sessions.memberId, memberId))
      .all();
    const currentSessionId = cookie.match(/kosu_session=([^;]+)/)![1];
    expect(after.map((session) => session.id)).toEqual([currentSessionId]);

    connection.sqlite.close();
  });

  test("admin password reset removes all sessions for the target member", async () => {
    const adminCookie = await setupAndLoginAdmin("password123");
    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );

    const createForm = new FormData();
    createForm.append("displayName", "Member");
    createForm.append("email", "member@example.com");
    createForm.append("role", "member");
    createForm.append("password", "memberpass123");

    await (newMemberAction as unknown as RouteActionHandler)({
      request: buildRequest(createForm, adminCookie),
      params: {},
      context: buildContext(),
    });

    const target = connection.db
      .select()
      .from(members)
      .where(eq(members.email, "member@example.com"))
      .get();
    expect(target).toBeDefined();

    const targetLoginForm = new FormData();
    targetLoginForm.append("email", "member@example.com");
    targetLoginForm.append("password", "memberpass123");
    const targetLogin = await (loginAction as unknown as RouteActionHandler)({
      request: buildRequest(targetLoginForm),
      params: {},
      context: buildContext(),
    });
    expect(targetLogin).toBeInstanceOf(Response);

    const before = connection.db
      .select()
      .from(sessions)
      .where(eq(sessions.memberId, target!.id))
      .all();
    expect(before.length).toBe(1);

    const resetForm = new FormData();
    resetForm.append("intent", "update");
    resetForm.append("displayName", "Member");
    resetForm.append("email", "member@example.com");
    resetForm.append("role", "member");
    resetForm.append("password", "resetpass123");

    const resetResponse = await (
      memberDetailAction as unknown as RouteActionHandler
    )({
      request: buildRequest(resetForm, adminCookie),
      params: { id: target!.id },
      context: buildContext(),
    });
    expect(resetResponse).toBeInstanceOf(Response);

    const after = connection.db
      .select()
      .from(sessions)
      .where(eq(sessions.memberId, target!.id))
      .all();
    expect(after).toHaveLength(0);

    connection.sqlite.close();
  });

  test("last active administrator cannot be deactivated or demoted", async () => {
    const adminCookie = await setupAndLoginAdmin("password123");
    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );
    const admin = connection.db
      .select()
      .from(members)
      .where(eq(members.email, "admin@example.com"))
      .get()!;

    const deactivateForm = new FormData();
    deactivateForm.append("intent", "deactivate");

    const deactivateResponse = await (
      memberDetailAction as unknown as RouteActionHandler
    )({
      request: buildRequest(deactivateForm, adminCookie),
      params: { id: admin.id },
      context: buildContext(),
    });
    expect((deactivateResponse as { error?: string }).error).toContain(
      "最後のアクティブ管理者",
    );

    const stillActive = connection.db
      .select()
      .from(members)
      .where(eq(members.id, admin.id))
      .get()!;
    expect(stillActive.isActive).toBe(true);
    expect(stillActive.role).toBe("admin");

    const demoteForm = new FormData();
    demoteForm.append("intent", "update");
    demoteForm.append("displayName", "Admin");
    demoteForm.append("email", "admin@example.com");
    demoteForm.append("role", "member");

    const demoteResponse = await (
      memberDetailAction as unknown as RouteActionHandler
    )({
      request: buildRequest(demoteForm, adminCookie),
      params: { id: admin.id },
      context: buildContext(),
    });
    expect((demoteResponse as { error?: string }).error).toContain(
      "最後のアクティブ管理者",
    );

    const stillAdmin = connection.db
      .select()
      .from(members)
      .where(eq(members.id, admin.id))
      .get()!;
    expect(stillAdmin.role).toBe("admin");

    connection.sqlite.close();
  });

  test("administrator can be demoted while another active administrator remains", async () => {
    const adminCookie = await setupAndLoginAdmin("password123");
    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );
    const admin = connection.db
      .select()
      .from(members)
      .where(eq(members.email, "admin@example.com"))
      .get()!;

    const secondAdminForm = new FormData();
    secondAdminForm.append("displayName", "Second Admin");
    secondAdminForm.append("email", "second@example.com");
    secondAdminForm.append("role", "admin");
    secondAdminForm.append("password", "secondpass123");

    await (newMemberAction as unknown as RouteActionHandler)({
      request: buildRequest(secondAdminForm, adminCookie),
      params: {},
      context: buildContext(),
    });

    const demoteForm = new FormData();
    demoteForm.append("intent", "update");
    demoteForm.append("displayName", "Admin");
    demoteForm.append("email", "admin@example.com");
    demoteForm.append("role", "member");

    const demoteResponse = await (
      memberDetailAction as unknown as RouteActionHandler
    )({
      request: buildRequest(demoteForm, adminCookie),
      params: { id: admin.id },
      context: buildContext(),
    });
    expect(demoteResponse).toBeInstanceOf(Response);
    expect((demoteResponse as Response).headers.get("Location")).toBe(
      "/members",
    );

    const demoted = connection.db
      .select()
      .from(members)
      .where(eq(members.id, admin.id))
      .get()!;
    expect(demoted.role).toBe("member");

    connection.sqlite.close();
  });

  test("member create and edit require an optional non-negative integer hourly cost", async () => {
    const adminCookie = await setupAndLoginAdmin("password123");
    const invalidCreate = new FormData();
    invalidCreate.append("displayName", "Invalid Rate");
    invalidCreate.append("email", "invalid-rate@example.com");
    invalidCreate.append("role", "member");
    invalidCreate.append("hourlyCostRate", "-1");
    invalidCreate.append("password", "password123");

    const invalidCreateResponse = await (
      newMemberAction as unknown as RouteActionHandler
    )({
      request: buildRequest(invalidCreate, adminCookie),
      params: {},
      context: buildContext(),
    });
    expect((invalidCreateResponse as { error: string }).error).toContain(
      "0 以上の整数",
    );

    const validCreate = new FormData();
    validCreate.append("displayName", "Zero Rate");
    validCreate.append("email", "zero-rate@example.com");
    validCreate.append("role", "member");
    validCreate.append("hourlyCostRate", "0");
    validCreate.append("password", "password123");
    await (newMemberAction as unknown as RouteActionHandler)({
      request: buildRequest(validCreate, adminCookie),
      params: {},
      context: buildContext(),
    });

    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );
    expect(
      connection.db
        .select()
        .from(members)
        .where(eq(members.email, "invalid-rate@example.com"))
        .get(),
    ).toBeUndefined();
    const target = connection.db
      .select()
      .from(members)
      .where(eq(members.email, "zero-rate@example.com"))
      .get()!;
    expect(target.hourlyCostRate).toBe(0);

    const invalidEdit = new FormData();
    invalidEdit.append("intent", "update");
    invalidEdit.append("displayName", target.displayName);
    invalidEdit.append("email", target.email);
    invalidEdit.append("role", target.role);
    invalidEdit.append("hourlyCostRate", "1.5");
    const invalidEditResponse = await (
      memberDetailAction as unknown as RouteActionHandler
    )({
      request: buildRequest(invalidEdit, adminCookie),
      params: { id: target.id },
      context: buildContext(),
    });
    expect((invalidEditResponse as { error: string }).error).toContain(
      "0 以上の整数",
    );
    expect(
      connection.db
        .select()
        .from(members)
        .where(eq(members.id, target.id))
        .get()?.hourlyCostRate,
    ).toBe(0);

    const emptyEdit = new FormData();
    emptyEdit.append("intent", "update");
    emptyEdit.append("displayName", target.displayName);
    emptyEdit.append("email", target.email);
    emptyEdit.append("role", target.role);
    emptyEdit.append("hourlyCostRate", "");
    await (memberDetailAction as unknown as RouteActionHandler)({
      request: buildRequest(emptyEdit, adminCookie),
      params: { id: target.id },
      context: buildContext(),
    });
    expect(
      connection.db
        .select()
        .from(members)
        .where(eq(members.id, target.id))
        .get()?.hourlyCostRate,
    ).toBeNull();
    connection.sqlite.close();
  });

  test("member detail loader does not expose password hash", async () => {
    const adminCookie = await setupAndLoginAdmin("password123");
    const connection = createDatabaseConnection(
      resolveDatabaseConfig().databaseUrl,
    );
    const admin = connection.db
      .select()
      .from(members)
      .where(eq(members.email, "admin@example.com"))
      .get()!;

    const response = await (
      memberDetailLoader as unknown as RouteLoaderHandler
    )({
      request: new Request("http://localhost/members", {
        headers: { Cookie: adminCookie },
      }),
      params: { id: admin.id },
      context: buildContext(),
    });
    const payload = JSON.stringify(response);
    expect(payload).not.toContain("passwordHash");

    connection.sqlite.close();
  });
});

async function setupAndLoginAdmin(password: string) {
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

  return match ? `kosu_session=${match[1]}` : "";
}

type AppLoadContext = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

type RouteActionHandler = (args: {
  request: Request;
  params: Record<string, string | undefined>;
  context: AppLoadContext;
}) => Promise<unknown>;
type RouteLoaderHandler = (args: {
  request: Request;
  params?: Record<string, string | undefined>;
  context: AppLoadContext;
}) => Promise<unknown>;
