export function isValidQuarterHour(value: number) {
  return Number.isFinite(value) && value > 0 && value * 4 === Math.round(value * 4);
}

export function formatHours(value: number) {
  return `${value}h`;
}
