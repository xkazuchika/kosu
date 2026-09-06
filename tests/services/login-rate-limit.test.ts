// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  getClientKeyFromRequest,
  isLoginThrottled,
  recordLoginFailure,
  resetLoginRateLimiter,
} from "../../app/services/login-rate-limit";

beforeEach(() => {
  resetLoginRateLimiter();
  delete process.env.KOSU_LOGIN_RATE_LIMIT_MAX;
  delete process.env.KOSU_LOGIN_RATE_LIMIT_WINDOW_MS;
});

afterEach(() => {
  resetLoginRateLimiter();
});

describe("login rate limiter", () => {
  test("extracts client key from forwarded header", () => {
    const request = new Request("http://localhost/", {
      headers: { "X-Forwarded-For": "203.0.113.5, 70.41.3.18" },
    });
    expect(getClientKeyFromRequest(request)).toBe("203.0.113.5");
  });

  test("falls back to direct key when no forwarded header", () => {
    const request = new Request("http://localhost/");
    expect(getClientKeyFromRequest(request)).toBe("direct");
  });

  test("does not throttle below the failure threshold", () => {
    for (let i = 0; i < 9; i += 1) {
      recordLoginFailure("client-a");
    }
    expect(isLoginThrottled("client-a")).toBe(false);
  });

  test("throttles after the configured failure count", () => {
    process.env.KOSU_LOGIN_RATE_LIMIT_MAX = "3";

    for (let i = 0; i < 3; i += 1) {
      recordLoginFailure("client-a");
    }
    expect(isLoginThrottled("client-a")).toBe(true);
  });

  test("throttles independently per client key", () => {
    process.env.KOSU_LOGIN_RATE_LIMIT_MAX = "2";

    recordLoginFailure("client-a");
    recordLoginFailure("client-a");

    expect(isLoginThrottled("client-a")).toBe(true);
    expect(isLoginThrottled("client-b")).toBe(false);
  });

  test("accepts new failures after the window expires", () => {
    process.env.KOSU_LOGIN_RATE_LIMIT_WINDOW_MS = "1";

    recordLoginFailure("client-a");
    recordLoginFailure("client-a");

    awaitExpiration();
    recordLoginFailure("client-a");

    expect(isLoginThrottled("client-a")).toBe(false);
  });
});

function awaitExpiration() {
  const start = Date.now();

  while (Date.now() - start < 5) {
    // busy-wait past the 1ms window
  }
}
