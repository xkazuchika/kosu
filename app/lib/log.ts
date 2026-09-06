export type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

type LogEntry = {
  level: LogLevel;
  event: string;
  message: string;
  at: string;
} & LogContext;

const sensitiveKeys = [
  "password",
  "passwordHash",
  "sessionId",
  "hourlyCostRate",
  "hourly_cost_rate",
];

function sanitize(context: LogContext): LogContext {
  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    sanitized[key] = sensitiveKeys.includes(key) ? "[redacted]" : value;
  }

  return sanitized;
}

export function log(
  level: LogLevel,
  event: string,
  message: string,
  context: LogContext = {},
) {
  const entry: LogEntry = {
    level,
    event,
    message,
    at: new Date().toISOString(),
    ...sanitize(context),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return line;
  }

  if (level === "warn") {
    console.warn(line);
    return line;
  }

  console.info(line);
  return line;
}

export function logInfo(event: string, message: string, context?: LogContext) {
  return log("info", event, message, context);
}

export function logWarn(event: string, message: string, context?: LogContext) {
  return log("warn", event, message, context);
}

export function logError(event: string, message: string, context?: LogContext) {
  return log("error", event, message, context);
}

export function logRouteError(route: string, error: unknown) {
  return logError("route.action_failed", "ルートの action が失敗しました", {
    route,
    reason: error instanceof Error ? error.message : String(error),
  });
}
