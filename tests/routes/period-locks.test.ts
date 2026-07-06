// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, test } from "vitest";

import { action as monthlyPlansAdminAction, loader as monthlyPlansAdminLoader } from "../../app/routes/monthly-plans.admin";
import { action as periodLocksAction, loader as periodLocksLoader } from "../../app/routes/period-locks";
import { buildContext, buildRequest, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-period-locks-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe("period locks", () => {
  test("admin locks and unlocks a month", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const lockForm = new FormData();
    lockForm.append("intent", "lock");
    lockForm.append("month", "2026-07");

    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const locksResponse = await (periodLocksLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/period-locks", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const locks = (locksResponse as { locks: { month: string; isLocked: boolean }[] }).locks;
    expect(locks.some((lock) => lock.month === "2026-07" && lock.isLocked)).toBe(true);

    const unlockForm = new FormData();
    unlockForm.append("intent", "unlock");
    unlockForm.append("month", "2026-07");

    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(unlockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const unlockedResponse = await (periodLocksLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/period-locks", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    const unlockedLocks = (unlockedResponse as { locks: { month: string; isLocked: boolean }[] }).locks;
    expect(unlockedLocks.some((lock) => lock.month === "2026-07" && !lock.isLocked)).toBe(true);
  });

  test("monthly plan admin shows locked status", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const lockForm = new FormData();
    lockForm.append("intent", "lock");
    lockForm.append("month", "2026-07");

    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const adminResponse = await (monthlyPlansAdminLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/monthly-plans/admin?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    expect((adminResponse as { isLocked: boolean }).isLocked).toBe(true);
  });

  test("locked month prevents capacity edit", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const lockForm = new FormData();
    lockForm.append("intent", "lock");
    lockForm.append("month", "2026-07");

    await (periodLocksAction as unknown as RouteActionHandler)({
      request: buildRequest(lockForm, cookie),
      params: {},
      context: buildContext(),
    });

    const adminLoader = await (monthlyPlansAdminLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/monthly-plans/admin?month=2026-07", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
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
    ).rejects.toBeInstanceOf(Response);
  });
});
