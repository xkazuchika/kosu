// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDatabaseConnection } from "../../app/db/client";
import { findMemberByEmail } from "../../app/db/repositories/members";
import { createProject } from "../../app/db/repositories/projects";
import { createMonthlyPlan } from "../../app/db/repositories/monthly-plans";
import { createMemberMonthlyCapacity } from "../../app/db/repositories/member-monthly-capacities";
import { createDailyWorkLog } from "../../app/db/repositories/daily-work-logs";
import { createEffortAllocation } from "../../app/db/repositories/effort-allocations";
import { setEffortConfirmed } from "../support/monthly-cost-close-fixtures";
import { action as workLogAction } from "../../app/routes/work-logs.$date";
import { loader as financialLoader } from "../../app/routes/reports.project-financials";

import {
  action as monthlyPlansAdminAction,
  loader as monthlyPlansAdminLoader,
} from "../../app/routes/monthly-plans.admin";
import {
  action as monthlyCloseAction,
  loader as monthlyCloseLoader,
} from "../../app/routes/period-locks";
import {
  buildContext,
  buildRequest,
  setupAndLogin,
  type RouteActionHandler,
  type RouteLoaderHandler,
} from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(
    os.tmpdir(),
    `kosu-monthly-close-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
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
    request: new Request(`http://localhost/period-locks?month=${month}`, {
      headers: { Cookie: cookie },
    }),
    context: buildContext(),
  });
}

describe("monthly cost close route", () => {
  test("effort-only confirmation rejects every monthly plan/capacity write and allocation deletion without side effects", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const { db, sqlite } = createDatabaseConnection();
    try {
      const admin = findMemberByEmail(db, "admin@example.com")!;
      const project = createProject(db, {
        code: "INT",
        name: "Internal",
        projectType: "internal",
      });
      const plan = createMonthlyPlan(db, {
        memberId: admin.id,
        projectId: project.id,
        month: "2026-07",
        plannedHours: 8,
      });
      const capacity = createMemberMonthlyCapacity(db, {
        memberId: admin.id,
        month: "2026-07",
        capacityHours: 160,
      });
      const log = createDailyWorkLog(db, {
        memberId: admin.id,
        workDate: "2026-07-10",
        totalWorkingHours: 8,
      });
      const allocation = createEffortAllocation(db, {
        dailyWorkLogId: log.id,
        memberId: admin.id,
        projectId: project.id,
        allocatedHours: 8,
      });
      setEffortConfirmed(db, { month: "2026-07", actorMemberId: admin.id });
      const before = sqlite.serialize();
      for (const intent of [
        "plan",
        "updatePlan",
        "deletePlan",
        "capacity",
        "deleteCapacity",
        "confirmPlan",
      ]) {
        const form = new FormData();
        for (const [key, value] of Object.entries({
          intent,
          month: "2026-07",
          memberId: admin.id,
          projectId: project.id,
          plannedHours: "4",
          capacityHours: "120",
          revision: "0",
          id: intent === "deleteCapacity" ? capacity.id : plan.id,
        }))
          form.set(key, value);
        await expect(
          (monthlyPlansAdminAction as unknown as RouteActionHandler)({
            request: buildRequest(form, cookie),
            params: {},
            context: buildContext(),
          }),
        ).rejects.toMatchObject({ status: 423 });
      }
      const form = new FormData();
      form.set("deleteAllocationId", allocation.id);
      await expect(
        (workLogAction as unknown as RouteActionHandler)({
          request: buildRequest(form, cookie),
          params: { date: "2026-07-10" },
          context: buildContext(),
        }),
      ).rejects.toMatchObject({ status: 423 });
      expect(sqlite.serialize()).toEqual(before);
      const financial = await (
        financialLoader as unknown as RouteLoaderHandler
      )({
        request: new Request(
          "http://localhost/reports/project-financials?month=2026-07",
          { headers: { Cookie: cookie } },
        ),
        context: buildContext(),
      });
      expect(financial).toMatchObject({ closeStatus: "open" });
    } finally {
      sqlite.close();
    }
  });

  test("blank correction rate cannot be coerced to zero", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    for (const hourlyCostRate of ["", " "]) {
      expect(
        await runCloseAction(cookie, {
          intent: "correctCost",
          month: "2026-07",
          targetType: "monthly_plan",
          targetId: "unused",
          hourlyCostRate,
          reason: "補正",
        }),
      ).toMatchObject({ error: expect.stringContaining("時間単価") });
    }
  });
  test("administrator moves a complete zero-activity month through review and approval", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    expect(
      await runCloseAction(cookie, {
        intent: "startEffortReview",
        month: "2026-07",
      }),
    ).toMatchObject({ success: expect.stringContaining("レビュー") });
    expect(await loadClose(cookie)).toMatchObject({
      periodState: {
        effortStatus: "in_review",
        costStatus: "open",
        isProtected: true,
      },
      completeness: { blockers: [] },
    });

    await runCloseAction(cookie, { intent: "confirmEffort", month: "2026-07" });
    expect(await loadClose(cookie)).toMatchObject({
      state: { status: "open", label: "原価未確認" },
      periodState: { effortStatus: "confirmed" },
    });
    await runCloseAction(cookie, { intent: "startReview", month: "2026-07" });
    expect(
      await runCloseAction(cookie, { intent: "approve", month: "2026-07" }),
    ).toMatchObject({ success: expect.stringContaining("承認") });
    const approved = (await loadClose(cookie)) as {
      state: { status: string };
      history: { eventType: string }[];
    };
    expect(approved.state.status).toBe("approved");
    expect(approved.history.map((event) => event.eventType)).toEqual([
      "effort_reviewed",
      "effort_confirmed",
      "entered_review",
      "approved",
    ]);
  });

  test("reopen requires a reason and appends it to history", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await runCloseAction(cookie, {
      intent: "startEffortReview",
      month: "2026-07",
    });

    expect(
      await runCloseAction(cookie, {
        intent: "reopen",
        month: "2026-07",
        reason: "",
      }),
    ).toMatchObject({ error: expect.stringContaining("理由") });
    await runCloseAction(cookie, {
      intent: "reopen",
      month: "2026-07",
      reason: "月次予定を修正するため",
    });

    expect(await loadClose(cookie)).toMatchObject({
      state: { status: "open", isProtected: false },
      history: [
        { eventType: "effort_reviewed" },
        { eventType: "reopened", reason: "月次予定を修正するため" },
      ],
    });
  });

  test("protected status is visible and administrators cannot bypass capacity protection", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    await runCloseAction(cookie, {
      intent: "startEffortReview",
      month: "2026-07",
    });

    await runCloseAction(cookie, { intent: "confirmEffort", month: "2026-07" });
    const adminLoader = await (
      monthlyPlansAdminLoader as unknown as RouteLoaderHandler
    )({
      request: new Request(
        "http://localhost/monthly-plans/admin?month=2026-07",
        {
          headers: { Cookie: cookie },
        },
      ),
      context: buildContext(),
    });
    expect(adminLoader).toMatchObject({
      isLocked: true,
      closeStatus: "confirmed",
    });
    const adminMember = (adminLoader as { members: { id: string }[] })
      .members[0];
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
    await expect(
      runCloseAction(cookie, { intent: "startEffortReview", month: "2026-07" }),
    ).rejects.toBeInstanceOf(Response);
  });
});
