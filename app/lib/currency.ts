export function parseOptionalYen(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined;
}
