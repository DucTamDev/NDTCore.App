import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';

/** One decoded IPL command: its recognized type tag and the raw params text it was matched from, matching portakal's `{type, params}` shape in `parsers/ipl.ts`. */
export interface IPLCommand {
  type: string;
  params: string;
}

/** Full result of parsing an IPL source string. */
export interface IPLParseResult {
  commands: IPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const STX = '\x02';
const ETX = '\x03';
const ESC = '\x1b';

const DEFAULT_WIDTH_DOTS = 832; // matches portakal's own IPL parser fallback
const DEFAULT_HEIGHT_DOTS = 400; // matches portakal's own IPL parser fallback

/**
 * Parses Intermec/Honeywell IPL source into structured commands plus a
 * best-effort recovery of `PrintElement`s — ported directly from portakal's
 * `parseIPL()` (`parsers/ipl.ts`). IPL frames every command between
 * `STX`/`ETX`; this parser splits on that framing first, then classifies
 * each frame as an `ESC`-prefixed format-lifecycle command, an `<SI>`
 * configuration command, one of the `H`/`B`/`L`/`W`/`G` field commands, the
 * bare `R` (print) command, or `UNKNOWN`.
 */
export function parseIPL(code: string): IPLParseResult {
  const commands: IPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = DEFAULT_HEIGHT_DOTS;

  const frames: string[] = [];
  let pos = 0;
  while (pos < code.length) {
    const stxIdx = code.indexOf(STX, pos);
    if (stxIdx < 0) break;
    const etxIdx = code.indexOf(ETX, stxIdx);
    if (etxIdx < 0) {
      frames.push(code.slice(stxIdx + 1));
      break;
    }
    frames.push(code.slice(stxIdx + 1, etxIdx));
    pos = etxIdx + 1;
  }

  for (const frame of frames) {
    if (frame.startsWith(ESC)) {
      const cmdChar = frame[1];
      const params = frame.slice(2);

      switch (cmdChar) {
        case 'C':
          commands.push({ type: 'CREATE_FORMAT', params });
          break;
        case 'E':
          commands.push({ type: 'END_FORMAT', params });
          break;
        case 'P':
          commands.push({ type: 'PROGRAM_MODE', params });
          break;
        case 'M':
          commands.push({ type: 'COPIES', params });
          break;
        default:
          commands.push({ type: `ESC_${cmdChar}`, params });
      }
      continue;
    }

    if (frame.startsWith('<SI>') || frame.startsWith('SI>')) {
      const rest = frame.replace(/^<?SI>/, '');
      const key = rest[0];
      const value = rest.slice(1);

      switch (key) {
        case 'L':
          heightDots = Number(value) || heightDots;
          commands.push({ type: 'LABEL_LENGTH', params: value });
          break;
        case 'W':
          widthDots = Number(value) || widthDots;
          commands.push({ type: 'LABEL_WIDTH', params: value });
          break;
        case 'S':
          commands.push({ type: 'SPEED', params: value });
          break;
        case 'd':
          commands.push({ type: 'DARKNESS', params: value });
          break;
        default:
          commands.push({ type: `SI_${key}`, params: value });
      }
      continue;
    }

    if (frame.startsWith('H') || frame.startsWith('B') || frame.startsWith('L') || frame.startsWith('W') || frame.startsWith('G')) {
      const fieldType = frame[0];
      const rest = frame.slice(1);

      const semiIdx = rest.indexOf(';');
      const fieldNum = semiIdx >= 0 ? rest.slice(0, semiIdx) : rest;
      const fieldParams = semiIdx >= 0 ? rest.slice(semiIdx + 1) : '';

      commands.push({ type: `FIELD_${fieldType}`, params: `${fieldNum};${fieldParams}` });

      if (fieldType === 'H') {
        const oMatch = fieldParams.match(/o(-?\d+),(-?\d+)/);
        const dMatch = fieldParams.match(/d\d+,(.+)$/);
        if (oMatch && dMatch) {
          elements.push({
            type: 'text',
            content: dMatch[1]!,
            options: { x: Number(oMatch[1]), y: Number(oMatch[2]) },
          });
        }
      }

      if (fieldType === 'W') {
        const oMatch = fieldParams.match(/o(-?\d+),(-?\d+)/);
        const lMatch = fieldParams.match(/l(\d+)/);
        const hMatch = fieldParams.match(/h(\d+)/);
        const wMatch = fieldParams.match(/w(\d+)/);
        if (oMatch && lMatch && hMatch) {
          elements.push({
            type: 'box',
            options: {
              x: Number(oMatch[1]),
              y: Number(oMatch[2]),
              width: Number(lMatch[1]),
              height: Number(hMatch[1]),
              thickness: wMatch ? Number(wMatch[1]) : 1,
            },
          });
        }
      }

      if (fieldType === 'L') {
        const oMatch = fieldParams.match(/o(-?\d+),(-?\d+)/);
        const lMatch = fieldParams.match(/l(\d+)/);
        const wMatch = fieldParams.match(/w(\d+)/);
        const fMatch = fieldParams.match(/f(\d+)/);
        if (oMatch && lMatch) {
          const x = Number(oMatch[1]);
          const y = Number(oMatch[2]);
          const len = Number(lMatch[1]);
          const t = wMatch ? Number(wMatch[1]) : 1;
          const dir = fMatch ? Number(fMatch[1]) : 0;
          if (dir === 0) {
            elements.push({ type: 'line', options: { x1: x, y1: y, x2: x + len, y2: y, thickness: t } });
          } else {
            elements.push({ type: 'line', options: { x1: x, y1: y, x2: x, y2: y + len, thickness: t } });
          }
        }
      }

      continue;
    }

    if (frame === 'R') {
      commands.push({ type: 'PRINT', params: '' });
      continue;
    }

    commands.push({ type: 'UNKNOWN', params: frame });
  }

  return { commands, widthDots, heightDots, elements, warnings };
}

/** Decodes IPL source into structured commands. */
export class IplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseIPL(code);
  }
}
