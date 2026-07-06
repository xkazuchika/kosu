// @vitest-environment node

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { createDatabaseConnection, runMigrations } from "../../app/db/client";
import type { KosuDatabase } from "../../app/db/client";
import { members, sessions } from "../../app/db/schema";
import {
  authenticateMember,
  createMemberSession,
  getSessionMember,
  isSetupComplete,
  requireAdministrator,
  requireAuth,
  setupWorkspace,
} from "../../app/services/auth";
import { setSessionCookie } from "../../app/services/session";

let db: KosuDatabase;
let connection: ReturnType<typeof createDatabaseConnection>;

function createRequestWithSession(sessionId: string) {
  return new Request("http://localhost/", {
    headers: { Cookie: setSessionCookie(sessionId) },
  });
}

beforeEach(() => {
  connection = createDatabaseConnection(":memory:");
  db = connection.db;
  runMigrations(connection);
});

afterEach(() => {
  connection.sqlite.close();
});

describe("auth service", () => {
  test("setup is not complete when workspace is missing", () => {
    expect(isSetupComplete(db)).toBe(false);
  });

  test("setup workspace creates workspace and administrator", async () => {
    const result = await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    expect(result.workspace.displayName).toBe("Acme");
    expect(result.administrator.role).toBe("admin");
    expect(isSetupComplete(db)).toBe(true);
  });

  test("setup cannot run twice", async () => {
    await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    await expect(
      setupWorkspace(db, {
        workspaceName: "Acme2",
        defaultTimezone: "Asia/Tokyo",
        administratorName: "Admin2",
        administratorEmail: "admin2@example.com",
        administratorPassword: "password123",
      }),
    ).rejects.toThrow("Setup is already complete");
  });

  test("authenticate member with valid credentials", async () => {
    await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    const member = await authenticateMember(db, { email: "admin@example.com", password: "password123" });
    expect(member?.email).toBe("admin@example.com");
  });

  test("authenticate member with invalid credentials returns null", async () => {
    await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    const member = await authenticateMember(db, { email: "admin@example.com", password: "wrong" });
    expect(member).toBeNull();
  });

  test("get session member from cookie", async () => {
    const { administrator } = await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    const session = createMemberSession(db, administrator.id);
    const request = createRequestWithSession(session.id);

    const member = getSessionMember(db, request);
    expect(member?.id).toBe(administrator.id);
  });

  test("expired session is rejected", async () => {
    const { administrator } = await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    const session = createMemberSession(db, administrator.id);
    db.update(sessions).set({ expiresAt: "2020-01-01T00:00:00Z" }).where(eq(sessions.id, session.id)).run();

    const request = createRequestWithSession(session.id);
    const member = getSessionMember(db, request);
    expect(member).toBeNull();
  });

  test("inactive member session is rejected", async () => {
    const { administrator } = await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    const session = createMemberSession(db, administrator.id);
    db.update(members).set({ isActive: false }).where(eq(members.id, administrator.id)).run();

    const request = createRequestWithSession(session.id);
    const member = getSessionMember(db, request);
    expect(member).toBeNull();
  });

  test("requireAuth throws for unauthenticated request", () => {
    const request = new Request("http://localhost/");
    expect(() => requireAuth(db, request)).toThrow(Response);
  });

  test("requireAdministrator throws for non-admin member", async () => {
    const { administrator } = await setupWorkspace(db, {
      workspaceName: "Acme",
      defaultTimezone: "Asia/Tokyo",
      administratorName: "Admin",
      administratorEmail: "admin@example.com",
      administratorPassword: "password123",
    });

    db.update(members).set({ role: "member" }).where(eq(members.id, administrator.id)).run();

    const session = createMemberSession(db, administrator.id);
    const request = createRequestWithSession(session.id);

    expect(() => requireAdministrator(db, request)).toThrow(Response);
  });
});
