// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  log,
  logInfo,
  logRouteError,
  logWarn,
  type LogContext,
} from "../../app/lib/log";

type CapturedCall = { method: "info" | "warn" | "error"; line: string };

let captured: CapturedCall[] = [];

beforeEach(() => {
  captured = [];
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    captured.push({ method: "info", line });
  });
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    captured.push({ method: "warn", line });
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    captured.push({ method: "error", line });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function singleEntry() {
  expect(captured).toHaveLength(1);
  return JSON.parse(captured[0].line) as Record<string, unknown>;
}

describe("log output", () => {
  test("writes a single-line JSON record with level, event, message, and timestamp", () => {
    log("info", "test.event", "テストメッセージ");

    const entry = singleEntry();
    expect(entry.level).toBe("info");
    expect(entry.event).toBe("test.event");
    expect(entry.message).toBe("テストメッセージ");
    expect(typeof entry.at).toBe("string");
  });

  test("routes warn and error levels to the matching console method", () => {
    logWarn("test.warn", "警告");
    logInfo("test.info", "情報");

    expect(captured[0].method).toBe("warn");
    expect(captured[1].method).toBe("info");
  });
});

describe("credential redaction", () => {
  const sensitive: LogContext = {
    password: "secret",
    passwordHash: "$2b$10$abc",
    sessionId: "session-token",
    hourlyCostRate: 5000,
  };

  test("redacts passwords, hashes, session ids, and cost rates", () => {
    log("warn", "test.event", "メッセージ", sensitive);

    const entry = singleEntry();
    expect(entry.password).toBe("[redacted]");
    expect(entry.passwordHash).toBe("[redacted]");
    expect(entry.sessionId).toBe("[redacted]");
    expect(entry.hourlyCostRate).toBe("[redacted]");
  });

  test("never writes a raw password or cost rate value into the output", () => {
    log("error", "test.event", "メッセージ", sensitive);

    expect(captured[0].line).not.toContain("secret");
    expect(captured[0].line).not.toContain("session-token");
    expect(captured[0].line).not.toContain("5000");
  });

  test("preserves non-sensitive context", () => {
    log("warn", "test.event", "メッセージ", {
      month: "2026-01",
      actorMemberId: "member-1",
    });

    const entry = singleEntry();
    expect(entry.month).toBe("2026-01");
    expect(entry.actorMemberId).toBe("member-1");
  });
});

describe("route error logging", () => {
  test("records the route name and the error message", () => {
    logRouteError("work-logs.$date", new Error("保存できませんでした"));

    const entry = singleEntry();
    expect(entry.event).toBe("route.action_failed");
    expect(entry.route).toBe("work-logs.$date");
    expect(entry.reason).toBe("保存できませんでした");
    expect(entry.level).toBe("error");
  });

  test("handles non-error throwables", () => {
    logRouteError("projects.new", "plain string failure");

    const entry = singleEntry();
    expect(entry.reason).toBe("plain string failure");
  });
});
