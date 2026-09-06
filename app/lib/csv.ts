export function parseCsv(text: string): string[][] {
  const bomStripped = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < bomStripped.length; i++) {
    const char = bomStripped[i];
    const next = bomStripped[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        current.push(field);
        field = "";
      } else if (char === "\n") {
        current.push(field);
        lines.push(current);
        current = [];
        field = "";
      } else if (char === "\r") {
        // skip
      } else {
        field += char;
      }
    }
  }

  current.push(field);
  if (current.length > 1 || current[0] !== "") {
    lines.push(current);
  }

  return lines;
}

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

export function neutralizeCsvCell(value: string): string {
  if (value.length > 0 && FORMULA_PREFIXES.has(value[0]) && Number.isNaN(Number(value))) {
    return `'${value}`;
  }
  return value;
}

export function stringifyCsv(rows: string[][]): string {
  return rows
    .map((cells) =>
      cells
        .map((cell) => {
          const neutralized = neutralizeCsvCell(cell);
          if (neutralized.includes(",") || neutralized.includes('"') || neutralized.includes("\n")) {
            return `"${neutralized.replace(/"/g, '""')}"`;
          }
          return neutralized;
        })
        .join(","),
    )
    .join("\n");
}
