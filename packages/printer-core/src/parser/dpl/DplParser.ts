import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';

/** One decoded DPL command: its recognized type tag and the raw text it was matched from, matching portakal's `{type, params}` shape in `parsers/dpl.ts`. */
export interface DPLCommand {
  type: string;
  params: string;
}

/** Full result of parsing a DPL source string. */
export interface DPLParseResult {
  commands: DPLCommand[];
  widthDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 832; // matches portakal's own DPL parser fallback

/**
 * The offset portakal's DPL parser guesses a label-record's text content
 * starts at, regardless of that record's actual field layout (rotation +
 * col + row + height + width + a variable-length record-type marker). It's
 * only correct by coincidence for some field/font-length combinations —
 * ported exactly as portakal has it (see the spec's own "best-effort,
 * fragile even upstream" note), not corrected.
 */
const RECORD_CONTENT_OFFSET_GUESS = 20;

/**
 * Parses Honeywell/Datamax DPL source into structured commands plus a
 * best-effort recovery of `PrintElement`s — ported directly from portakal's
 * `parseDPL()` (`parsers/dpl.ts`). Label format records have no per-command
 * prefix character to key off of (unlike EPL2's single-letter commands or
 * ZPL's `^`/`~`-prefixed grammar); this parser only recognizes the
 * document-level `D`/`S`/`A`/`Q` setup commands plus `STX L`/`E` for
 * entering/leaving label mode — every other digit-led line inside label mode
 * is read as an opaque fixed-field `RECORD`, with `PrintElement` recovery
 * limited to the same offset-guessed text extraction portakal itself does.
 */
export function parseDPL(code: string): DPLParseResult {
  const commands: DPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let inLabel = false;

  for (const rawLine of code.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === '\x02L' || line === 'L') {
      inLabel = true;
      commands.push({ type: 'STX_L', params: '' });
      continue;
    }

    if (line === 'E' && inLabel) {
      inLabel = false;
      commands.push({ type: 'E', params: '' });
      continue;
    }

    if (line.startsWith('D') && line.length <= 4 && /^D\d{1,2}$/.test(line)) {
      commands.push({ type: 'DENSITY', params: line.slice(1) });
      continue;
    }

    if (line.startsWith('S') && /^S\d{1,2}$/.test(line)) {
      commands.push({ type: 'SPEED', params: line.slice(1) });
      continue;
    }

    if (line.startsWith('A') && /^A\d{4}$/.test(line)) {
      widthDots = Number(line.slice(1));
      commands.push({ type: 'WIDTH', params: line.slice(1) });
      continue;
    }

    if (line.startsWith('Q') && /^Q\d{4}$/.test(line)) {
      commands.push({ type: 'QUANTITY', params: line.slice(1) });
      continue;
    }

    // A digit-led line inside label mode is a fixed-width element record.
    // portakal also decodes a `rotation` value here (`Number(line[0])`)
    // that it never uses for anything — provably inert, so it isn't
    // reproduced here.
    if (inLabel && /^\d/.test(line)) {
      if (line.length >= 13) {
        const col = Number(line.slice(1, 5));
        const row = Number(line.slice(5, 9));
        commands.push({ type: 'RECORD', params: line });

        if (line.length > RECORD_CONTENT_OFFSET_GUESS) {
          const content = line.slice(Math.min(RECORD_CONTENT_OFFSET_GUESS, line.length));
          if (content && /[A-Za-z0-9]/.test(content)) {
            elements.push({
              type: 'text',
              content,
              options: { x: col, y: row },
            });
          }
        }
      }
      continue;
    }

    commands.push({ type: 'OTHER', params: line });
  }

  return { commands, widthDots, elements, warnings };
}

/** Decodes DPL source into structured commands. */
export class DplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseDPL(code);
  }
}
