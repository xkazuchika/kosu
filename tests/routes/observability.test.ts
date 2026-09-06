// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { action as loginAction } from "../../app/routes/login";
import {
  action as periodLocksAction,
  loader as periodLocksLoader,
} from "../../app/routes/period-locks";
import { action as workLogDateAction } from "../../app/routes/work-logs.$date";
import { resetLoginRateLimiter } from "../../app/services/login-rate-limit";
import {
  buildContext,
  buildRequest,
  setupAndLogin,
  type RouteActionHandler,
  type RouteLoaderHandler,
} from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;
let originalRateLimitMax: string | undefined;
let output: string[];

function tempDataDir() {
  return path.join(
    os.tmpdir(),
    `kosu-observability-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
}

beforeEach(() => {
  dataDir = tempDataDir();
  mkdirSync(dataDir, { recursive: true });
  originalDataDir = process.env.KOSU_DATA_DIR;
  originalRateLimitMax = process.env.KOSU_LOGIN_RATE_LIMIT_MAX;
  output = [];

  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    output.push(line);
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    output.push(line);
  });
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    output.push(line);
  });

  resetLoginRateLimiter();
});

afterEach(() => {
  vi.restoreAllMocks();

  if (originalRateLimitMax !== undefined) {
    process.env.KOSU_LOGIN_RATE_LIMIT_MAX = originalRateLimitMax;
  } else {
    delete process.env.KOSU_LOGIN_RATE_LIMIT_MAX;
  }

  if (originalDataDir !== undefined) {
    process.env.KOSU_DATA_DIR = originalDataDir;
  } else {
    delete process.env.KOSU_DATA_DIR;
  }

  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

type LogEntry = { event?: string; [key: string]: unknown };

function entries(): LogEntry[] {
  return output.flatMap((line) => {
    try {
      return [JSON.parse(line) as LogEntry];
    } catch {
      return [];
    }
  });
}

function findEntry(event: string) {
  return entries().find((entry) => entry.event === event);
}

async function attemptLogin(email: string, password: string) {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);

  return (loginAction as unknown as RouteActionHandler)({
    request: buildRequest(form),
    params: {},
    context: buildContext(),
  });
}

describe("sign-in failure logging", () => {
  test("records a failed sign-in without writing the password", async () => {
    await setupAndLogin(dataDir, "password123");

    const response = await attemptLogin("admin@example.com", "wrong-password");
    expect((response as { error: string }).error).toContain("正しくありません");

    const entry = findEntry("auth.login_failed");
    expect(entry).toBeDefined();
    expect(output.join("\n")).not.toContain("wrong-password");
  });

  test("records the email domain but not the local part", async () => {
    await setupAndLogin(dataDir, "password123");

    await attemptLogin("admin@example.com", "wrong-password");

    const entry = findEntry("auth.login_failed");
    expect(entry?.emailDomain).toBe("example.com");
    expect(JSON.stringify(entry)).not.toContain("admin@");
  });

  test("records a throttled sign-in attempt", async () => {
    process.env.KOSU_LOGIN_RATE_LIMIT_MAX = "1";
    await setupAndLogin(dataDir, "password123");

    await attemptLogin("admin@example.com", "wrong-password");

    output = [];
    const response = await attemptLogin("admin@example.com", "wrong-password");

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(429);
    expect(findEntry("auth.login_throttled")).toBeDefined();
  });
});

describe("authorization rejection logging", () => {
  test("records an administrator-only rejection without leaking credentials", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    await expect(
      (periodLocksLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/period-locks", {
          headers: { Cookie: cookie },
        }),
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);

    expect(findEntry("auth.forbidden")).toBeDefined();
    expect(output.join("\n")).not.toContain("password123");
  });

  test("records a rejection when writing to a protected month", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const reviewForm = new FormData();
    reviewForm.append("intent", "startReview");
    reviewForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(reviewForm, cookie),
      params: {},
      context: buildContext(),
    });

    output = [];

    const workLogForm = new FormData();
    workLogForm.append("intent", "saveDay");
    workLogForm.append("totalWorkingHours", "8");
    await expect(
      (workLogDateAction as unknown as RouteActionHandler)({
        request: buildRequest(workLogForm, cookie),
        params: { date: "2026-07-15" },
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);

    const entry = findEntry("monthly_close.protected_write_rejected");
    expect(entry?.month).toBe("2026-07");
  });
});

describe("monthly close action logging", () => {
  test("records entering review and approval with the target month and actor", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const reviewForm = new FormData();
    reviewForm.append("intent", "startReview");
    reviewForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(reviewForm, cookie),
      params: {},
      context: buildContext(),
    });

    expect(findEntry("monthly_close.entered_review")).toBeDefined();

    const approveForm = new FormData();
    approveForm.append("intent", "approve");
    approveForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(approveForm, cookie),
      params: {},
      context: buildContext(),
    });

    const approval = findEntry("monthly_close.approved");
    expect(approval?.month).toBe("2026-07");
    expect(approval?.actorMemberId).toBeTruthy();
  });

  test("records reopening and cost correction", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const reviewForm = new FormData();
    reviewForm.append("intent", "startReview");
    reviewForm.append("month", "2026-07");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(reviewForm, cookie),
      params: {},
      context: buildContext(),
    });

    const reopenForm = new FormData();
    reopenForm.append("intent", "reopen");
    reopenForm.append("month", "2026-07");
    reopenForm.append("reason", "入力漏れの補正のため");
    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(reopenForm, cookie),
      params: {},
      context: buildContext(),
    });

    const reopened = findEntry("monthly_close.reopened");
    expect(reopened?.month).toBe("2026-07");
    expect(JSON.stringify(reopened)).not.toContain("入力漏れの補正のため");
  });
});
