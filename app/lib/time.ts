export function isValidQuarterHour(value: number) {
  return Number.isFinite(value) && value > 0 && value * 4 === Math.round(value * 4);
}

export function formatHours(value: number) {
  return `${value}h`;
}

export function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function listMonthDates(month: string) {
  if (!isValidMonth(month)) {
    return [];
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  const dates: string[] = [];

  while (date.getUTCFullYear() === year && date.getUTCMonth() === monthNumber - 1) {
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
