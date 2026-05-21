const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[",\r\n]/.test(text);
  const escaped = text.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const toCsvString = (headers: string[], rows: Array<Array<unknown>>): string => {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(","));
  rows.forEach((row) => {
    lines.push(row.map(escapeCsvCell).join(","));
  });
  return `${lines.join("\r\n")}\r\n`;
};

export const downloadCsv = (filename: string, headers: string[], rows: Array<Array<unknown>>): void => {
  const csv = toCsvString(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const parseCsv = (input: string): string[][] => {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushCell();
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    if (ch === "\r") {
      const next = text[i + 1];
      if (next === "\n") i += 1;
      pushCell();
      pushRow();
      continue;
    }

    cell += ch;
  }

  pushCell();
  pushRow();

  // Trim trailing completely empty rows
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.every((value) => value.trim() === "")) {
      rows.pop();
    } else {
      break;
    }
  }

  return rows;
};

