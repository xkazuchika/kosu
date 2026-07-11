// @vitest-environment node

import { existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection } from "../../app/db/client";
import { resolveDatabaseConfig } from "../../app/db/config";
import { listImportJobs } from "../../app/db/repositories/import-jobs";
import { findMemberByEmail } from "../../app/db/repositories/members";
import { projects } from "../../app/db/schema";
import { verifyPassword } from "../../app/lib/password";
import { action as importsAction, loader as importsLoader } from "../../app/routes/imports";
import { buildContext, setupAndLogin, type RouteActionHandler, type RouteLoaderHandler } from "./helpers";

let dataDir: string;
let originalDataDir: string | undefined;

function tempDataDir() {
  return path.join(os.tmpdir(), `kosu-imports-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

function buildMultipartRequest(formData: FormData, cookie = "") {
  return new Request("http://localhost/imports", {
    method: "POST",
    body: formData,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

describe("imports", () => {
  test("admin loader returns import page", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const response = await (importsLoader as unknown as RouteLoaderHandler)({
      request: new Request("http://localhost/imports", { headers: { Cookie: cookie } }),
      context: buildContext(),
    });
    expect((response as { type: string }).type).toBe("members");
  });

  test("member cannot access imports", async () => {
    const cookie = await setupAndLogin(dataDir, "password123", "member");

    await expect(
      (importsLoader as unknown as RouteLoaderHandler)({
        request: new Request("http://localhost/imports", { headers: { Cookie: cookie } }),
        context: buildContext(),
      }),
    ).rejects.toBeInstanceOf(Response);
  });

  test("template download returns csv header", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const formData = new FormData();
    formData.append("intent", "template");
    formData.append("type", "members");

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).text();
    expect(body).toContain("email");
    expect(body).toContain("displayName");
  });

  test("invalid import type is rejected", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const formData = new FormData();
    formData.append("intent", "template");
    formData.append("type", "toString");

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect((response as { error: string }).error).toContain("不正");
  });

  test("preview validates member rows", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const csv = "email,displayName,role,departmentName,hourlyCostRate,isActive\ninvalid,missing email role,,,x\n";
    const file = new File([csv], "members.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("intent", "preview");
    formData.append("type", "members");
    formData.append("file", file);

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    const preview = (response as { preview: { validRows: number; invalidRows: number } }).preview;
    expect(preview.validRows).toBe(0);
    expect(preview.invalidRows).toBe(1);
  });

  test("preview rejects duplicate keys in the csv", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const csv = "code,name,projectType,clientName,revenueOrBudgetAmount\nPRJ-001,Website,internal,,\nPRJ-001,Website Copy,internal,,\n";
    const file = new File([csv], "projects.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("intent", "preview");
    formData.append("type", "projects");
    formData.append("file", file);

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    const preview = (response as { preview: { validRows: number; invalidRows: number; rows: { errors: string[] }[] } }).preview;
    expect(preview.validRows).toBe(0);
    expect(preview.invalidRows).toBe(2);
    expect(preview.rows.every((row) => row.errors.some((error) => error.includes("重複")))).toBe(true);
  });

  test("member import commit requires explicit initial password", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const csv = "email,displayName,role,departmentName,hourlyCostRate,isActive\nnew@example.com,New User,member,Engineering,3000,true\n";
    const file = new File([csv], "members.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("intent", "commit");
    formData.append("type", "members");
    formData.append("file", file);

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect((response as { error: string }).error).toContain("初期パスワード");
  });

  test("member import updates existing member without resetting password", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const csv = "email,displayName,role,departmentName,hourlyCostRate,isActive\nadmin@example.com,Admin Renamed,admin,Engineering,5000,true\n";
    const file = new File([csv], "members.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("intent", "commit");
    formData.append("type", "members");
    formData.append("defaultPassword", "newpassword");
    formData.append("file", file);

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect((response as { result: { imported: number } }).result.imported).toBe(1);

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const member = findMemberByEmail(connection.db, "admin@example.com")!;
    expect(member.displayName).toBe("Admin Renamed");
    expect(await verifyPassword("password123", member.passwordHash)).toBe(true);
    expect(await verifyPassword("newpassword", member.passwordHash)).toBe(false);
    connection.sqlite.close();
  });

  test("commit records an import job", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const csv = "code,name,projectType,clientName,revenueOrBudgetAmount\nPRJ-001,Website,internal,,\n";
    const file = new File([csv], "projects.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("intent", "commit");
    formData.append("type", "projects");
    formData.append("file", file);

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect((response as { result: { imported: number; failed: number } }).result).toEqual({
      imported: 1,
      failed: 0,
      createdByMemberId: expect.any(String),
    });

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const jobs = listImportJobs(connection.db);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      importType: "projects",
      status: "committed",
      fileName: "projects.csv",
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    connection.sqlite.close();
  });

  test("project import keeps legacy amount separate from financial baseline", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");
    const csv = "code,name,projectType,clientName,revenueOrBudgetAmount,contractRevenueAmount,laborCostBudgetAmount\nPRJ-001,Website,billable,,100000,1200000,600000\n";
    const file = new File([csv], "projects.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("intent", "commit");
    formData.append("type", "projects");
    formData.append("file", file);

    await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });

    const connection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const project = connection.db.select().from(projects).get()!;
    expect(project.revenueOrBudgetAmount).toBe(100_000);
    expect(project.contractRevenueAmount).toBe(1_200_000);
    expect(project.laborCostBudgetAmount).toBe(600_000);
    connection.sqlite.close();

    const updateCsv = "code,name,projectType,clientName,revenueOrBudgetAmount,contractRevenueAmount,laborCostBudgetAmount\nPRJ-001,Website,billable,,,1300000,650000\n";
    const updateFile = new File([updateCsv], "projects-update.csv", { type: "text/csv" });
    const updateFormData = new FormData();
    updateFormData.append("intent", "commit");
    updateFormData.append("type", "projects");
    updateFormData.append("file", updateFile);

    await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(updateFormData, cookie),
      params: {},
      context: buildContext(),
    });

    const updatedConnection = createDatabaseConnection(resolveDatabaseConfig().databaseUrl);
    const updatedProject = updatedConnection.db.select().from(projects).get()!;
    expect(updatedProject.revenueOrBudgetAmount).toBe(100_000);
    expect(updatedProject.contractRevenueAmount).toBe(1_300_000);
    expect(updatedProject.laborCostBudgetAmount).toBe(650_000);
    updatedConnection.sqlite.close();
  });

  test("admin exports master data csv", async () => {
    const cookie = await setupAndLogin(dataDir, "password123");

    const formData = new FormData();
    formData.append("intent", "export");
    formData.append("type", "members");

    const response = await (importsAction as unknown as RouteActionHandler)({
      request: buildMultipartRequest(formData, cookie),
      params: {},
      context: buildContext(),
    });
    expect(response).toBeInstanceOf(Response);
    const body = await (response as Response).text();
    expect(body).toContain("admin@example.com");
    expect((response as Response).headers.get("Content-Disposition")).toContain("kosu-members-export.csv");
  });
});
