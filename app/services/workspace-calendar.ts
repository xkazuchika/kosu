import type { KosuDatabase } from "~/db/client";
import { findWorkspace } from "~/db/repositories/workspace";
import { getCalendarDate, getCalendarMonth, normalizeTimeZone } from "~/lib/time";

const fallbackTimeZone = "UTC";

export type WorkspaceCalendarContext = {
  configuredTimeZone: string | null;
  currentMonth: string;
  timeZone: string;
  timezoneWarning: string | null;
  today: string;
};

export function getWorkspaceCalendarContext(
  db: KosuDatabase,
  referenceTime = new Date(),
): WorkspaceCalendarContext {
  const workspace = findWorkspace(db);
  const configuredTimeZone = workspace?.defaultTimezone ?? null;
  const normalizedTimeZone = configuredTimeZone ? normalizeTimeZone(configuredTimeZone) : null;
  const timeZone = normalizedTimeZone ?? fallbackTimeZone;
  const timezoneWarning =
    configuredTimeZone && !normalizedTimeZone
      ? `設定済みのタイムゾーン「${configuredTimeZone}」を認識できないため、UTCを使用しています。設定画面で修正してください。`
      : null;

  return {
    configuredTimeZone,
    currentMonth: getCalendarMonth(referenceTime, timeZone),
    timeZone,
    timezoneWarning,
    today: getCalendarDate(referenceTime, timeZone),
  };
}
