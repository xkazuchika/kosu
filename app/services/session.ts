import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "kosu_session";

function isSecureEnvironment() {
  return process.env.NODE_ENV === "production";
}

function getSessionSecret() {
  return process.env.KOSU_SESSION_SECRET ?? "";
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function signSession(sessionId: string, secret: string): string {
  return `${sessionId}.${sign(sessionId, secret)}`;
}

function verifySession(signedValue: string, secret: string): string | undefined {
  const separatorIndex = signedValue.lastIndexOf(".");

  if (separatorIndex === -1) {
    return undefined;
  }

  const sessionId = signedValue.slice(0, separatorIndex);
  const signature = signedValue.slice(separatorIndex + 1);
  const expected = sign(sessionId, secret);

  if (signature.length !== expected.length) {
    return undefined;
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return undefined;
  }

  return sessionId;
}

export function getSessionCookie(request: Request) {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, value] = part.trim().split("=");

    if (name === cookieName && value !== undefined) {
      let decoded: string;

      try {
        decoded = decodeURIComponent(value);
      } catch {
        return undefined;
      }

      const secret = getSessionSecret();

      if (!secret) {
        return decoded;
      }

      return verifySession(decoded, secret);
    }
  }

  return undefined;
}

function serializeCookie(name: string, value: string, options: { maxAge?: number } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (isSecureEnvironment()) {
    parts.push("Secure");
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

export function setSessionCookie(sessionId: string) {
  const secret = getSessionSecret();
  const value = secret ? signSession(sessionId, secret) : sessionId;
  return serializeCookie(cookieName, value, { maxAge: 60 * 60 * 24 * 7 });
}

export function clearSessionCookie(): string {
  return serializeCookie(cookieName, "", { maxAge: 0 });
}
