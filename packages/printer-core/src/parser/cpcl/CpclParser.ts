import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';

/**
 * One decoded CPCL command: its verb and the raw whitespace-split tokens
 * following it on the same line — matches portakal's own `{cmd, params}`
 * shape in `parsers/cpcl.ts`, kept as-is rather than folded into `EplParser`'s
 * `{cmd, raw}` shape since each language parser in this package owns its own
 * command shape (CPCL's grammar is space-token-delimited within a line,
 * unlike EPL2's single comma-delimited `raw` remainder).
 */
export interface CPCLCommand {
  cmd: string;
  params: string[];
}

/** Full result of parsing a CPCL source string. */
export interface CPCLParseResult {
  commands: CPCLCommand[];
  widthDots: number;
  heightDots: number;
  dpi: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 576; // matches portakal's own CPCL parser fallback
const DEFAULT_HEIGHT_DOTS = 400; // matches portakal's own CPCL parser fallback
const DEFAULT_DPI = 203; // matches portakal's own CPCL parser fallback

/**
 * Parses CPCL source into structured commands plus preview-renderable
 * `PrintElement`s — ported directly from portakal's `parseCPCL()`
 * (`parsers/cpcl.ts`), keeping the exact command coverage: `!`/`TEXT*`/`BOX`/
 * `LINE`/`PAGE-WIDTH` are decoded into an element or label dimension, every
 * other recognized CPCL verb (`BARCODE`, `EG`, `CG`, `PRINT`, `CENTER`,
 * `LEFT`, `RIGHT`, etc.) is still recorded in `commands` but intentionally
 * not turned into an element — a portakal-native limitation documented in
 * its own parser, not a port bug. Session-based like the real protocol: the
 * `!` header line seeds `dpi`/`heightDots`, and CPCL text fields consume a
 * second, following line of raw data rather than carrying it inline.
 */
export function parseCPCL(code: string): CPCLParseResult {
  const commands: CPCLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = DEFAULT_HEIGHT_DOTS;
  let dpi = DEFAULT_DPI;

  const lines = code.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;

    // `!` starts the session header (`! <offset> <hDPI> <vDPI> <height> <copies>`) —
    // excluded from `!U` (a distinct printer-config verb sharing the `!` prefix).
    if (line.startsWith('!') && !line.startsWith('!U')) {
      const parts = line.slice(1).trim().split(/\s+/);
      if (parts.length >= 4) {
        dpi = Number(parts[1]) || dpi;
        heightDots = Number(parts[3]) || heightDots;
      }
      commands.push({ cmd: '!', params: parts });
      continue;
    }

    const parts = line.split(/\s+/);
    const cmd = parts[0].toUpperCase();
    commands.push({ cmd, params: parts.slice(1) });

    // TEXT/TEXT90/TEXT180/TEXT270 (plus the T/VTEXT aliases) share the same
    // parameter shape: `<font> <size> <x> <y>`, with the string to print
    // carried on the line that follows rather than inline.
    if (cmd.startsWith('TEXT') || cmd === 'T' || cmd === 'VTEXT') {
      const font = parts[1] ?? '2';
      const size = Number(parts[2] ?? 0);
      const x = Number(parts[3] ?? 0);
      const y = Number(parts[4] ?? 0);
      // Consume the following line as this field's text content.
      if (i < lines.length) {
        const data = lines[i].trim();
        i++;
        elements.push({
          type: 'text',
          content: data,
          options: { x, y, font, size },
        });
      }
      continue;
    }

    if (cmd === 'BOX') {
      const x1 = Number(parts[1] ?? 0);
      const y1 = Number(parts[2] ?? 0);
      const x2 = Number(parts[3] ?? 0);
      const y2 = Number(parts[4] ?? 0);
      const t = Number(parts[5] ?? 1);
      elements.push({
        type: 'box',
        options: { x: x1, y: y1, width: x2 - x1, height: y2 - y1, thickness: t },
      });
      continue;
    }

    if (cmd === 'LINE') {
      const x1 = Number(parts[1] ?? 0);
      const y1 = Number(parts[2] ?? 0);
      const x2 = Number(parts[3] ?? 0);
      const y2 = Number(parts[4] ?? 0);
      const t = Number(parts[5] ?? 1);
      elements.push({
        type: 'line',
        options: { x1, y1, x2, y2, thickness: t },
      });
      continue;
    }

    if (cmd === 'PAGE-WIDTH') {
      widthDots = Number(parts[1]) || widthDots;
      continue;
    }

    // Every other recognized verb (BARCODE, EG, CG, PRINT, CENTER, LEFT,
    // RIGHT, etc.) has already been recorded in `commands` above and simply
    // falls through here without producing an element.
  }

  return { commands, widthDots, heightDots, dpi, elements, warnings };
}

/** Decodes CPCL source into structured commands (line-based, session-delimited by `!` and `PRINT`). */
export class CpclParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseCPCL(code);
  }
}
