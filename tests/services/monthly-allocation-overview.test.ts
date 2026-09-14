// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import { createMember } from "../../app/db/repositories/members";
import { createProject } from "../../app/db/repositories/projects";
import {
  createMonthlyPlan,
  updateMonthlyPlan,
  deleteMonthlyPlan,
} from "../../app/db/repositories/monthly-plans";
import {
  createMemberMonthlyCapacity,
  updateMemberMonthlyCapacity,
  deleteMemberMonthlyCapacity,
} from "../../app/db/repositories/member-monthly-capacities";
import { findMonthlyPlanReview } from "../../app/db/repositories/member-monthly-plan-reviews";
import { members, monthlyCostCloses } from "../../app/db/schema";
import { confirmMonthlyPlan } from "../../app/services/monthly-plan-review";
import { getMonthlyAllocationOverview } from "../../app/services/monthly-allocation-overview";

let connection: ReturnType<typeof createDatabaseConnection>;
let adminId: string;
let projectId: string;
const month = "2026-09";
beforeEach(() => {
  connection = createDatabaseConnection(":memory:");
  runMigrations(connection);
  adminId = createMember(connection.db, {
    displayName: "Admin",
    email: "admin@example.com",
    passwordHash: "hash",
    role: "admin",
  }).id;
  projectId = createProject(connection.db, {
    code: "A",
    name: "案件A",
    projectType: "billable",
  }).id;
});
afterEach(() => connection.sqlite.close());
const review = () => findMonthlyPlanReview(connection.db, adminId, month);
const confirm = () =>
  confirmMonthlyPlan(connection.db, {
    actorMemberId: adminId,
    memberId: adminId,
    month,
    revision: review()?.revision ?? 0,
  });
const overview = () =>
  getMonthlyAllocationOverview(connection.db, month).rows.find(
    (r) => r.memberId === adminId,
  )!;

test("aggregates roles and internal work; availability requires confirmation", () => {
  const { db } = connection;
  createMemberMonthlyCapacity(db, {
    memberId: adminId,
    month,
    capacityHours: 160,
  });
  for (const [assignmentRole, plannedHours] of [
    ["lead", 60],
    ["review", 20],
  ] as const)
    createMonthlyPlan(db, {
      memberId: adminId,
      projectId,
      month,
      assignmentRole,
      plannedHours,
    });
  for (const [code, projectType, plannedHours] of [
    ["B", "non_billable", 40],
    ["I", "internal", 20],
  ] as const) {
    const p = createProject(db, { code, name: code, projectType });
    createMonthlyPlan(db, {
      memberId: adminId,
      projectId: p.id,
      month,
      plannedHours,
    });
  }
  expect(overview()).toMatchObject({
    totalPlanned: 140,
    balanceHours: 20,
    availableHours: null,
    isConfirmed: false,
  });
  expect(
    overview().cells.find((c) => c.projectId === projectId)?.plannedHours,
  ).toBe(80);
  confirm();
  expect(overview()).toMatchObject({ availableHours: 20, isConfirmed: true });
  expect(JSON.stringify(getMonthlyAllocationOverview(db, month))).not.toMatch(
    /passwordHash|hourlyCost|contractRevenue/,
  );
});

test("distinguishes unset, zero, confirmed empty planning and excess", () => {
  expect(overview()).toMatchObject({
    capacityHours: null,
    balanceHours: null,
    isConfirmed: false,
  });
  confirm();
  expect(overview()).toMatchObject({ isConfirmed: true, availableHours: null });
  const capacity = createMemberMonthlyCapacity(connection.db, {
    memberId: adminId,
    month,
    capacityHours: 160,
  });
  expect(overview().isConfirmed).toBe(false);
  confirm();
  expect(overview().availableHours).toBe(160);
  updateMemberMonthlyCapacity(connection.db, capacity.id, { capacityHours: 0 });
  confirm();
  expect(overview()).toMatchObject({ capacityHours: 0, availableHours: 0 });
  createMonthlyPlan(connection.db, {
    memberId: adminId,
    projectId,
    month,
    plannedHours: 10,
  });
  expect(overview()).toMatchObject({
    balanceHours: -10,
    overplannedHours: 10,
    isConfirmed: false,
  });
});

test("every planning mutation invalidates only its member/month, atomically", () => {
  const { db, sqlite } = connection;
  confirm();
  confirmMonthlyPlan(db, {
    actorMemberId: adminId,
    memberId: adminId,
    month: "2026-10",
    revision: 0,
  });
  const plan = createMonthlyPlan(db, {
    memberId: adminId,
    projectId,
    month,
    plannedHours: 10,
  });
  expect(review()?.confirmedAt).toBeNull();
  confirm();
  updateMonthlyPlan(db, plan.id, { plannedHours: 20 });
  expect(review()?.confirmedAt).toBeNull();
  confirm();
  const before = review();
  updateMonthlyPlan(db, plan.id, { hourlyCostRateSnapshot: 1000 });
  expect(review()).toEqual(before);
  expect(() =>
    db.transaction(() => {
      deleteMonthlyPlan(db, plan.id);
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(review()).toEqual(before);
  deleteMonthlyPlan(db, plan.id);
  expect(review()?.confirmedAt).toBeNull();
  confirm();
  const cap = createMemberMonthlyCapacity(db, {
    memberId: adminId,
    month,
    capacityHours: 160,
  });
  confirm();
  updateMemberMonthlyCapacity(db, cap.id, { capacityHours: 150 });
  expect(review()?.confirmedAt).toBeNull();
  confirm();
  deleteMemberMonthlyCapacity(db, cap.id);
  expect(review()?.confirmedAt).toBeNull();
  expect(
    findMonthlyPlanReview(db, adminId, "2026-10")?.confirmedAt,
  ).not.toBeNull();
  const moved = createMonthlyPlan(db, {
    memberId: adminId,
    projectId,
    month,
    plannedHours: 8,
  });
  confirm();
  sqlite
    .prepare("UPDATE monthly_plans SET month = '2026-10' WHERE id = ?")
    .run(moved.id);
  expect(review()?.confirmedAt).toBeNull();
  expect(findMonthlyPlanReview(db, adminId, "2026-10")?.confirmedAt).toBeNull();
});

test("rejects stale forms, invalid targets, unauthorized and protected confirmations", () => {
  const { db } = connection;
  createMonthlyPlan(db, {
    memberId: adminId,
    projectId,
    month,
    plannedHours: 8,
  });
  expect(() =>
    confirmMonthlyPlan(db, {
      actorMemberId: adminId,
      memberId: adminId,
      month,
      revision: 0,
    }),
  ).toThrow("変更されています");
  for (const invalidMonth of ["2026-13", "0000-01", "bad"])
    expect(() =>
      confirmMonthlyPlan(db, {
        actorMemberId: adminId,
        memberId: adminId,
        month: invalidMonth,
        revision: 0,
      }),
    ).toThrow("不正");
  const member = createMember(db, {
    displayName: "Member",
    email: "member@example.com",
    passwordHash: "hash",
  });
  expect(() =>
    confirmMonthlyPlan(db, {
      actorMemberId: member.id,
      memberId: adminId,
      month,
      revision: 1,
    }),
  ).toThrow();
  db.update(members)
    .set({ isActive: false })
    .where(eq(members.id, member.id))
    .run();
  for (const target of [member.id, "missing"])
    expect(() =>
      confirmMonthlyPlan(db, {
        actorMemberId: adminId,
        memberId: target,
        month,
        revision: 0,
      }),
    ).toThrow("有効なメンバー");
  for (const status of ["in_review", "approved"] as const) {
    db.insert(monthlyCostCloses)
      .values({ id: status, month, status })
      .onConflictDoUpdate({ target: monthlyCostCloses.month, set: { status } })
      .run();
    expect(() => confirm()).toThrow();
    expect(review()?.confirmedAt).toBeNull();
  }
});

test("preserves inactive and archived history without suggesting availability", () => {
  const { db, sqlite } = connection;
  createMonthlyPlan(db, {
    memberId: adminId,
    projectId,
    month,
    plannedHours: 8,
  });
  createMemberMonthlyCapacity(db, {
    memberId: adminId,
    month,
    capacityHours: 160,
  });
  confirm();
  sqlite
    .prepare("UPDATE projects SET is_archived = 1 WHERE id = ?")
    .run(projectId);
  db.update(members)
    .set({ isActive: false })
    .where(eq(members.id, adminId))
    .run();
  expect(overview()).toMatchObject({
    isActive: false,
    availableHours: null,
    totalPlanned: 8,
  });
  expect(overview().cells[0].assignmentRemoved).toBe(true);
  expect(getMonthlyAllocationOverview(db, month).projects[0].isArchived).toBe(
    true,
  );
});

test("migration preserves legacy values and enforces review constraints", () => {
  const old = createDatabaseConnection(":memory:");
  try {
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };
    for (const entry of journal.entries.filter(
      (e) => Number(e.tag.slice(0, 4)) < 8,
    ))
      old.sqlite.exec(
        readFileSync(`drizzle/${entry.tag}.sql`, "utf8").replaceAll(
          "--> statement-breakpoint",
          "",
        ),
      );
    const member = createMember(old.db, {
      displayName: "Old",
      email: "old@example.com",
      passwordHash: "hash",
    });
    const p = createProject(old.db, {
      code: "OLD",
      name: "Old",
      projectType: "internal",
    });
    const plan = createMonthlyPlan(old.db, {
      memberId: member.id,
      projectId: p.id,
      month,
      plannedHours: 8,
      hourlyCostRateSnapshot: 1234,
    });
    createMemberMonthlyCapacity(old.db, {
      memberId: member.id,
      month,
      capacityHours: 160,
    });
    old.sqlite.prepare("INSERT INTO monthly_cost_closes (id, month, status) VALUES (?, ?, ?)").run("close", month, "approved");
    const before = old.sqlite.prepare("SELECT * FROM monthly_plans").all();
    old.sqlite.exec(
      readFileSync("drizzle/0008_monthly_plan_reviews.sql", "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
    expect(old.sqlite.prepare("SELECT * FROM monthly_plans").all()).toEqual(
      before,
    );
    expect(
      old.sqlite.prepare("SELECT status FROM monthly_cost_closes").get(),
    ).toEqual({ status: "approved" });
    expect(findMonthlyPlanReview(old.db, member.id, month)).toBeUndefined();
    expect(getMonthlyAllocationOverview(old.db, month).rows[0]).toMatchObject({
      totalPlanned: plan.plannedHours,
      capacityHours: 160,
      isConfirmed: false,
    });
    const insert = old.sqlite.prepare(
      "INSERT INTO member_monthly_plan_reviews (member_id, month, revision) VALUES (?, ?, ?)",
    );
    for (const [m, r] of [
      ["2026-13", 0],
      ["0000-01", 0],
      [month, -1],
      [month, 0.5],
    ] as const)
      expect(() => insert.run(member.id, m, r)).toThrow();
    insert.run(member.id, month, 0);
    expect(() => insert.run(member.id, month, 0)).toThrow();
    expect(old.sqlite.pragma("foreign_key_check")).toEqual([]);
  } finally {
    old.sqlite.close();
  }
});
