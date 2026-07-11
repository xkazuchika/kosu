import { and, asc, eq } from "drizzle-orm";

import { createId } from "~/lib/id";

import type { KosuDatabase } from "../client";
import { members } from "../schema";

export type MemberRole = "admin" | "member";

export type MemberInsert = {
  displayName: string;
  email: string;
  passwordHash: string;
  role?: MemberRole;
  isActive?: boolean;
  departmentName?: string | null;
  hourlyCostRate?: number | null;
};

export type MemberUpdate = Partial<MemberInsert>;

export function listMembers(db: KosuDatabase) {
  return db.select().from(members).orderBy(asc(members.email)).all();
}

export function findMemberById(db: KosuDatabase, id: string) {
  return db.select().from(members).where(eq(members.id, id)).get();
}

export function findMemberByEmail(db: KosuDatabase, email: string) {
  return db.select().from(members).where(eq(members.email, email)).get();
}

export function createMember(db: KosuDatabase, input: MemberInsert) {
  return db
    .insert(members)
    .values({
      id: createId(),
      displayName: input.displayName,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role ?? "member",
      isActive: input.isActive ?? true,
      departmentName: input.departmentName ?? null,
      hourlyCostRate: input.hourlyCostRate ?? null,
    })
    .returning()
    .get();
}

export function updateMember(db: KosuDatabase, id: string, input: MemberUpdate) {
  return db
    .update(members)
    .set({
      displayName: input.displayName,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: input.isActive,
      departmentName: input.departmentName,
      hourlyCostRate: input.hourlyCostRate,
    })
    .where(eq(members.id, id))
    .returning()
    .get();
}

export function deactivateMember(db: KosuDatabase, id: string) {
  return db.update(members).set({ isActive: false }).where(eq(members.id, id)).returning().get();
}

export function activateMember(db: KosuDatabase, id: string) {
  return db.update(members).set({ isActive: true }).where(eq(members.id, id)).returning().get();
}

export function isAdministrator(member: { role: MemberRole }) {
  return member.role === "admin";
}

export function findActiveMemberByEmail(db: KosuDatabase, email: string) {
  return db.select().from(members).where(and(eq(members.email, email), eq(members.isActive, true))).get();
}

export function withoutMemberPasswordHash<T extends { passwordHash?: unknown }>(member: T) {
  const publicMember = { ...member };
  delete publicMember.passwordHash;
  return publicMember;
}

export function withoutMemberFinancials<T extends { hourlyCostRate?: unknown; passwordHash?: unknown }>(member: T) {
  const publicMember = withoutMemberPasswordHash(member);
  delete publicMember.hourlyCostRate;
  return publicMember;
}
