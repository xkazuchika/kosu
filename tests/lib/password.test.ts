// @vitest-environment node

import { test, expect } from "vitest";

import { hashPassword, verifyPassword } from "../../app/lib/password";

test("password hashing and verification", async () => {
  const hash = await hashPassword("password123");
  expect(hash).not.toBe("password123");

  const isValid = await verifyPassword("password123", hash);
  expect(isValid).toBe(true);

  const isInvalid = await verifyPassword("wrong-password", hash);
  expect(isInvalid).toBe(false);
});
