import type { Unit } from '../types';

/** A single parsed markup tag. */
export interface ParsedTag {
  name: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  content?: string;
}

/** Strip a unit suffix ("40mm" -> 40, "10" -> 10) — unit conversion happens in the builder. */
export function parseUnitValue(s: string): number {
  return Number(s.replace(/\s*(mm|inch|dot|px)$/i, ''));
}

/** Match either a self-closing or an opening tag and split out its name + attributes. */
export function parseTag(s: string): ParsedTag | null {
  const selfCloseMatch = s.match(/^<(\w+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/>/);
  if (selfCloseMatch) {
    return {
      name: selfCloseMatch[1].toLowerCase(),
      attrs: parseAttrs(selfCloseMatch[2]),
      selfClosing: true,
    };
  }

  const openMatch = s.match(/^<(\w+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*>/);
  if (openMatch) {
    return {
      name: openMatch[1].toLowerCase(),
      attrs: parseAttrs(openMatch[2]),
      selfClosing: false,
    };
  }

  return null;
}

/** Extract `key="value"` pairs from a tag's attribute string; a bare key (no `=`) becomes `"true"`. */
export function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)(?:="([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    attrs[m[1]] = m[2] ?? 'true';
  }
  return attrs;
}

/** Infer the unit from a dimension attribute's suffix (e.g. `<label>` width/height). */
export function getUnit(s: string): Unit {
  if (s.endsWith('mm')) return 'mm';
  if (s.endsWith('inch') || s.endsWith('in')) return 'inch';
  return 'dot';
}
