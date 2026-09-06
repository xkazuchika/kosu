import type { KosuDatabase } from "~/db/client";
import { createMember, findActiveMemberByEmail, findMemberById } from "~/db/repositories/members";
import { createSession, deleteExpiredSessions, deleteSession, findSessionById } from "~/db/repositories/sessions";
import { findWorkspace, createWorkspace } from "~/db/repositories/workspace";
import { logWarn } from "~/lib/log";
import { hashPassword, verifyPassword } from "~/lib/password";
import { normalizeTimeZone } from "~/lib/time";

import { clearSessionCookie, getSessionCookie, setSessionCookie } from "./session";

export type SetupInput = {
  workspaceName: string;
  defaultTimezone: string;
  administratorName: string;
  administratorEmail: string;
  administratorPassword: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export function isSetupComplete(db: KosuDatabase) {
  return Boolean(findWorkspace(db));
}

export async function setupWorkspace(db: KosuDatabase, input: SetupInput) {
  const defaultTimezone = normalizeTimeZone(input.defaultTimezone);

  if (!defaultTimezone) {
    throw new Error("Invalid workspace timezone");
  }

  const passwordHash = await hashPassword(input.administratorPassword);

  try {
    return db.transaction((tx) => {
      const transactionDb = tx as unknown as KosuDatabase;

      if (isSetupComplete(transactionDb)) {
        throw new Error("Setup is already complete");
      }

      const workspace = createWorkspace(transactionDb, {
        displayName: input.workspaceName,
        defaultTimezone,
      });

      const administrator = createMember(transactionDb, {
        displayName: input.administratorName,
        email: input.administratorEmail,
        passwordHash,
        role: "admin",
      });

      return { workspace, administrator };
    });
  } catch (error) {
    if (isSetupComplete(db)) {
      throw new Error("Setup is already complete", { cause: error });
    }

    throw error;
  }
}

export async function authenticateMember(db: KosuDatabase, input: LoginInput) {
  const member = findActiveMemberByEmail(db, input.email);
  const passwordHash = member?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const isValid = await verifyPassword(input.password, passwordHash);

  if (!member || !isValid) {
    return null;
  }

  return member;
}

const DUMMY_PASSWORD_HASH = "$2b$10$GAiTlWReg3uXDed3dBsTiOMC5tHi8brEmbtuyhLhkN9Zi0safa/dm";

export function createMemberSession(db: KosuDatabase, memberId: string) {
  deleteExpiredSessions(db);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const session = createSession(db, {
    memberId,
    expiresAt: expiresAt.toISOString(),
  });

  return session;
}

export function getSessionMember(db: KosuDatabase, request: Request) {
  const sessionId = getSessionCookie(request);

  if (!sessionId) {
    return null;
  }

  const session = findSessionById(db, sessionId);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt) < new Date()) {
    deleteSession(db, session.id);
    return null;
  }

  const member = findMemberById(db, session.memberId);

  if (!member || !member.isActive) {
    deleteSession(db, session.id);
    return null;
  }

  return member;
}

export function requireAuth(db: KosuDatabase, request: Request) {
  const member = getSessionMember(db, request);

  if (!member) {
    logWarn("auth.unauthenticated", "未認証のリクエストを拒否しました", { path: requestPath(request) });
    throw new Response("Unauthorized", { status: 401 });
  }

  return member;
}

export function requireAdministrator(db: KosuDatabase, request: Request) {
  const member = requireAuth(db, request);

  if (member.role !== "admin") {
    logWarn("auth.forbidden", "管理者権限のないリクエストを拒否しました", {
      path: requestPath(request),
      memberId: member.id,
    });
    throw new Response("Forbidden", { status: 403 });
  }

  return member;
}

function requestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

export { clearSessionCookie, setSessionCookie };
