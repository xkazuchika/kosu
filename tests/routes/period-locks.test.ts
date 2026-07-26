// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { action as monthlyPlansAdminAction, loader as monthlyPlansAdminLoader } from "../../app/routes/monthly-plans.admin";
import { action as monthlyCloseAction, loader as monthlyCloseLoader } from "../../app/routes/period-locks";
import { buildContext, buildRequest, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-monthly-close-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

beforeEach(() => {
  dataDir = tempDataDir();
  mkdirSync(dataDir, { recursive: true });
  originalDataDir = process.env.KOSU_DATA_DIR;
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

async function runCloseAction(cookie: string, entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.append(key, value);
  return (monthlyCloseAction as unknown as RouteActionHandler)({
    request: buildRequest(form, cookie),
    params: {},
    context: buildContext(),
  });
}

async function loadClose(cookie: string, month = "2026-07") {
  return (monthlyCloseLoader as unknown as RouteLoaderHandler)({
    request: new Request(`http://localhost/period-locks?month=${month}`, { headers: { Cookie: cookie } }),
    context: buildContext(),
  });
}

describe("monthly cost close route", () => {
  test("administrator moves a complete zero-activity month through review and approval", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    expect(await runCloseAction(cookie, { intent: "startReview", month: "2026-07" }))
      .toMatchObject({ success: expect.stringContaining("レビュー") });
    expect(await loadClose(cookie)).toMatchObject({
      state: { status: "in_review", isProtected: true },
      completeness: { blockers: [] },
    });

    expect(await runCloseAction(cookie, { intent: "approve", month: "2026-07" }))
      .toMatchObject({ success: expect.stringContaining("承認") });
    const approved = await loadClose(cookie) as {
      state: { status: string };
      history: { eventType: string }[];
    };
    expect(approved.state.status).toBe("approved");
    expect(approved.history.map((event) => event.eventType)).toEqual(["entered_review", "approved"]);
  });

  test("reopen requires a reason and appends it to history", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await runCloseAction(cookie, { intent: "startReview", month: "2026-07" });

    expect(await runCloseAction(cookie, { intent: "reopen", month: "2026-07", reason: "" }))
      .toMatchObject({ error: expect.stringContaining("理由") });
    await runCloseAction(cookie, {
      intent: "reopen",
      month: "2026-07",
      reason: "月次予定を修正するため",
    });

    expect(await loadClose(cookie)).toMatchObject({
      state: { status: "open", isProtected: false },
      history: [
        { eventType: "entered_review" },
        { eventType: "reopened", reason: "月次予定を修正するため" },
      ],
    });
  });

  test("protected status is visible and administrators cannot bypass capacity protection", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await runCloseAction(cookie, { intent: "startReview", month: "2026-07" });

    const adminLoader = await (monthlyPlansAdminLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/monthly-plans/admin?month=2026-07", {
        headers: { Cookie: cookie },
      }),
      context: buildContext(),
    });
    expect(adminLoader).toMatchObject({ isLocked: true, closeStatus: "in_review" });
    const adminMember = (adminLoader as { members: { id: string }[] }).members[0];
    const capacityForm = new FormData();
    capacityForm.append("intent", "capacity");
    capacityForm.append("memberId", adminMember.id);
    capacityForm.append("month", "2026-07");
    capacityForm.append("capacityHours", "160");

    await expect(
      (monthlyPlansAdminAction as unknown as RouteActionHandler)({
        request: buildRequest(capacityForm, cookie),
        params: {},
        context: buildContext(),
      }),
    ).rejects.toMatchObject({ status: 423 });
  });

  test("non-administrators cannot view or transition monthly close", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    await expect(loadClose(cookie)).rejects.toBeInstanceOf(Response);
    await expect(runCloseAction(cookie, { intent: "startReview", month: "2026-07" }))
      .rejects.toBeInstanceOf(Response);
  });
});
