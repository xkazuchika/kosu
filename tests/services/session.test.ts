// @vitest-environment node

import { describe, expect, test } from "vitest";

import { getSessionCookie, setSessionCookie } from "../../app/services/session";

describe("session cookie", () => {
  test("round-trips unsigned session id when no secret", () => {
    delete process.env.KOSU_SESSION_SECRET;
    const sessionId = "sess-123";
    const setCookie = setSessionCookie(sessionId);
    const request = new Request("http://localhost/", {
      headers: { Cookie: setCookie.split(";")[0] },
    });
    expect(getSessionCookie(request)).toBe(sessionId);
  });

  test("round-trips signed session id when secret is set", () => {
    process.env.KOSU_SESSION_SECRET = "a".repeat(32);
    const sessionId = "sess-456";
    const setCookie = setSessionCookie(sessionId);
    const request = new Request("http://localhost/", {
      headers: { Cookie: setCookie.split(";")[0] },
    });
    expect(getSessionCookie(request)).toBe(sessionId);
    delete process.env.KOSU_SESSION_SECRET;
  });

  test("rejects tampered signed cookie", () => {
    process.env.KOSU_SESSION_SECRET = "a".repeat(32);
    const request = new Request("http://localhost/", {
      headers: { Cookie: "kosu_session=tampered.bad" },
    });
    expect(getSessionCookie(request)).toBeUndefined();
    delete process.env.KOSU_SESSION_SECRET;
  });

  test("ignores malformed cookie encoding", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: "kosu_session=%E0%A4%A" },
    });
    expect(getSessionCookie(request)).toBeUndefined();
  });
});
