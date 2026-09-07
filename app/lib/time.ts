export function isValidQuarterHour(value: number) {
  return (
    Number.isFinite(value) && value > 0 && value * 4 === Math.round(value * 4)
  );
}

export function isNonNegativeQuarterHour(value: number) {
  return (
    Number.isFinite(value) && value >= 0 && value * 4 === Math.round(value * 4)
  );
}

export function parseOptionalQuarterHours(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (raw === "") {
    return null;
  }

  const hours = Number(raw);
  return isNonNegativeQuarterHour(hours) ? hours : undefined;
}

export function formatHours(value: number) {
  return `${value}h`;
}

export function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function normalizeTimeZone(value: string) {
  const timeZone = value.trim();

  if (!timeZone) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}

export function isValidTimeZone(value: string) {
  return normalizeTimeZone(value) !== null;
}

export function getCalendarDate(referenceTime: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceTime);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function getCalendarMonth(referenceTime: Date, timeZone: string) {
  return getCalendarDate(referenceTime, timeZone).slice(0, 7);
}

export function listMonthDates(month: string) {
  if (!isValidMonth(month)) {
    return [];
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  const dates: string[] = [];

  while (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === monthNumber - 1
  ) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return dates;
}

export function getWeekdayLabel(dateString: string) {
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return labels[new Date(`${dateString}T00:00:00.000Z`).getUTCDay()];
}

export function getWeekdayIndex(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
}

export function isWeekendDate(dateString: string) {
  const day = getWeekdayIndex(dateString);
  return day === 0 || day === 6;
}

export function isSundayDate(dateString: string) {
  return getWeekdayIndex(dateString) === 0;
}

export function isSaturdayDate(dateString: string) {
  return getWeekdayIndex(dateString) === 6;
}

export function addCalendarDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function listWeekDates(dateString: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return [];
  const weekday = getWeekdayIndex(dateString);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addCalendarDays(dateString, mondayOffset);
  return Array.from({ length: 7 }, (_, index) =>
    addCalendarDays(monday, index),
  );
}
