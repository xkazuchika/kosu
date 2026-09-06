const DEFAULT_MAX_FAILURES = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

type FailureRecord = {
  count: number;
  resetAt: number;
};

const failuresByClient = new Map<string, FailureRecord>();

export function getClientKeyFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();

  return ip || "direct";
}

function resolveMaxFailures() {
  const parsed = Number(process.env.KOSU_LOGIN_RATE_LIMIT_MAX);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FAILURES;
}

function resolveWindowMs() {
  const parsed = Number(process.env.KOSU_LOGIN_RATE_LIMIT_WINDOW_MS);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_MS;
}

export function isLoginThrottled(clientKey: string) {
  pruneExpiredFailures();
  const record = failuresByClient.get(clientKey);

  return Boolean(record && record.count >= resolveMaxFailures());
}

export function recordLoginFailure(clientKey: string) {
  pruneExpiredFailures();

  const now = Date.now();
  const record = failuresByClient.get(clientKey);

  if (record && record.resetAt > now) {
    record.count += 1;
    return;
  }

  failuresByClient.set(clientKey, { count: 1, resetAt: now + resolveWindowMs() });
}

export function resetLoginRateLimiter() {
  failuresByClient.clear();
}

function pruneExpiredFailures() {
  const now = Date.now();

  for (const [key, record] of failuresByClient) {
    if (record.resetAt <= now) {
      failuresByClient.delete(key);
    }
  }
}
