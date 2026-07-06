import { describe, expect, test } from "vitest";

import { requireProductionConfig, validateProductionConfig } from "../../app/lib/env";

describe("env validation", () => {
  test("non-production passes without secret", () => {
    const result = validateProductionConfig({ NODE_ENV: "development" });
    expect(result.ok).toBe(true);
  });

  test("production requires session secret", () => {
    const result = validateProductionConfig({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("KOSU_SESSION_SECRET（32文字以上）");
    }
  });

  test("production passes with long secret", () => {
    const result = validateProductionConfig({
      NODE_ENV: "production",
      KOSU_SESSION_SECRET: "a".repeat(32),
    });
    expect(result.ok).toBe(true);
  });

  test("requireProductionConfig throws in production without secret", () => {
    expect(() => requireProductionConfig({ NODE_ENV: "production" })).toThrow("KOSU_SESSION_SECRET");
  });
});
