import { ReceiptColumn } from './ReceiptColumn';

export function formatRow(columns: ReceiptColumn[], values: string[], totalWidth: number): string {
  if (columns.length === 0 || values.length === 0) return "";

  // If no explicit widths, auto-distribute
  let assignedWidth = 0;
  let autoCount = 0;
  for (const col of columns) {
    if (col.width > 0) {
      assignedWidth += col.width;
    } else {
      autoCount++;
    }
  }
  const autoWidth = autoCount > 0 ? Math.floor((totalWidth - assignedWidth) / autoCount) : 0;

  const parts: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    const val = values[i] ?? "";
    const w = col.width > 0 ? col.width : autoWidth;
    parts.push(alignText(val, w, col.align ?? "left"));
  }

  return parts.join("");
}

export function alignText(text: string, width: number, align: "left" | "center" | "right"): string {
  const truncated = text.length > width ? text.slice(0, width) : text;
  const padding = width - truncated.length;

  switch (align) {
    case "right":
      return " ".repeat(padding) + truncated;
    case "center": {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return " ".repeat(leftPad) + truncated + " ".repeat(rightPad);
    }
    default:
      return truncated + " ".repeat(padding);
  }
}

export function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}
