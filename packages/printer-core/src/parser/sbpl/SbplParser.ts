import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';

/** One decoded SBPL command: its recognized type tag and the raw text it carried, matching portakal's `{cmd, params}` shape in `parsers/sbpl.ts`. */
export interface SBPLCommand {
  cmd: string;
  params: string;
}

/** Full result of parsing an SBPL source string. */
export interface SBPLParseResult {
  commands: SBPLCommand[];
  elements: PrintElement[];
  warnings: string[];
}

const ESC = '\x1b';

/**
 * Parses SATO's SBPL source into structured commands plus a `PrintElement`
 * recovery — ported directly from portakal's `parseSBPL()` (`parsers/sbpl.ts`).
 * SBPL's grammar has no line structure to split on (unlike CPCL/EPL2's
 * newline-delimited commands) — every field is `<ESC>`-prefixed and
 * concatenated back to back, so this parser instead splits on the `ESC`
 * control character itself and switches on each fragment's leading letter.
 * Only `H`/`V` (tracked as running position state) and `K9B` (a text field,
 * turned into a `text` element at the tracked position) feed into
 * `elements` — every other recognized field (`FW` draw, `GM` graphics,
 * `B`/`D`/`2D`-prefixed barcode fields, `Q` quantity) is still recorded in
 * `commands` but intentionally not turned into an element, a portakal-native
 * limitation documented in its own parser, not a port bug.
 */
export function parseSBPL(code: string): SBPLParseResult {
  const commands: SBPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let currentX = 0;
  let currentY = 0;

  const parts = code.split(ESC);

  for (const part of parts) {
    if (!part) continue;

    const cmdChar = part[0];
    const rest = part.slice(1);

    switch (cmdChar) {
      case 'A':
        commands.push({ cmd: 'START', params: rest });
        break;

      case 'Z':
        commands.push({ cmd: 'END', params: rest });
        break;

      case 'C':
        if (rest.startsWith('S')) {
          commands.push({ cmd: 'CLEAR', params: rest });
        }
        break;

      case 'H':
        // The X-position field is always the 4 digits right after the letter.
        currentX = Number(rest.slice(0, 4)) || 0;
        commands.push({ cmd: 'H', params: rest.slice(0, 4) });
        break;

      case 'V':
        // Same 4-digit shape as 'H', but tracked separately for the Y axis.
        currentY = Number(rest.slice(0, 4)) || 0;
        commands.push({ cmd: 'V', params: rest.slice(0, 4) });
        break;

      case 'L':
        commands.push({ cmd: 'L', params: rest.slice(0, 4) });
        break;

      case '%':
        commands.push({ cmd: 'ROTATION', params: rest[0] ?? '0' });
        break;

      case 'K':
        // Only the `9B` (mixed ASCII/Kanji) font variant carries a decodable text payload.
        if (rest.startsWith('9B')) {
          const text = rest.slice(2).split(ESC)[0] ?? '';
          commands.push({ cmd: 'TEXT', params: text });
          elements.push({
            type: 'text',
            content: text,
            options: { x: currentX, y: currentY },
          });
        } else {
          commands.push({ cmd: 'K', params: rest });
        }
        break;

      case 'B':
      case 'D':
        commands.push({ cmd: `BARCODE_${cmdChar}`, params: rest });
        break;

      case 'G':
        // `GM` is the only graphics sub-command this printer language defines.
        if (rest.startsWith('M')) {
          commands.push({ cmd: 'GRAPHIC', params: rest });
        }
        break;

      case 'F':
        // `FW` is the only draw sub-command under the `F` prefix.
        if (rest.startsWith('W')) {
          commands.push({ cmd: 'DRAW', params: rest.slice(1) });
        }
        break;

      case 'Q':
        commands.push({ cmd: 'QUANTITY', params: rest });
        break;

      case '2':
        // 2D barcode fields are keyed off a leading digit rather than a letter.
        if (rest.startsWith('D')) {
          commands.push({ cmd: '2D_BARCODE', params: rest });
        }
        break;

      default:
        commands.push({ cmd: cmdChar, params: rest });
        break;
    }
  }

  return { commands, elements, warnings };
}

/** Decodes SBPL source into structured commands (`<ESC>`-delimited, framed by `<ESC>A`/`<ESC>Z`). */
export class SbplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseSBPL(code);
  }
}
