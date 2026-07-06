import { eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { sessions } from "../schema";

export type SessionInsert = {
  memberId: string;
  expiresAt: string;
};

export function findSessionById(db: KosuDatabase, id: string) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

export function createSession(db: KosuDatabase, input: SessionInsert) {
  return db
    .insert(sessions)
    .values({ id: createId(), memberId: input.memberId, expiresAt: input.expiresAt })
    .returning()
    .get();
}

export function deleteSession(db: KosuDatabase, id: string) {
  return db.delete(sessions).where(eq(sessions.id, id)).returning().get();
}

export function deleteSessionsForMember(db: KosuDatabase, memberId: string) {
  return db.delete(sessions).where(eq(sessions.memberId, memberId));
}
