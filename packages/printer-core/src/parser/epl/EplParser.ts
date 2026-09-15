import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';
import type { Rotation } from '../../types';

/**
 * One decoded EPL2 command: its single-letter command char and the raw text
 * following it on the same line (already trimmed). EPL2 is a line-based
 * language — each command is one line terminated by LF, per the EPL2
 * Programmer's Guide — so, unlike ZPL's `^`/`~`-prefixed grammar, no
 * multi-character tokenizer is needed; matches portakal's `{cmd, raw}` shape
 * in `parsers/epl.ts`.
 */
export interface EPLCommand {
  cmd: string;
  raw: string;
}

/** Full result of parsing an EPL2 source string. */
export interface EPLParseResult {
  commands: EPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 832; // matches portakal's own EPL parser fallback

/** EPL2 rotation code (`0`-`3`, the `A` command's own rotation field) back to a `Rotation`, the inverse of `EplCompiler`'s `eplRotation()`. */
function eplRotationFromCode(code: number): Rotation {
  switch (code) {
    case 1:
      return 90;
    case 2:
      return 180;
    case 3:
      return 270;
    default:
      return 0;
  }
}

/**
 * Parses EPL2 source into structured commands plus preview-renderable
 * `PrintElement`s — ported directly from portakal's `parseEPL()`
 * (`parsers/epl.ts`), keeping the exact command-char coverage: every
 * recognized single-letter command is either decoded into an element or
 * intentionally read-and-discarded (same switch branches, same grouping).
 * An unrecognized command char is silently skipped, matching portakal's own
 * parser exactly (it has no `default` branch pushing a warning, unlike
 * `ZplParser`/`TscParser` — `EplValidator` computes that check itself
 * instead, against the same known-command set).
 */
export function parseEPL(code: string): EPLParseResult {
  const commands: EPLCommand[] = [];
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = 0;

  for (const rawLine of code.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const cmdChar = line[0];
    const rest = line.slice(1).trim();
    commands.push({ cmd: cmdChar, raw: rest });

    switch (cmdChar) {
      case 'N':
        break;

      case 'q':
        widthDots = Number(rest) || widthDots;
        break;

      case 'Q': {
        const parts = rest.split(',');
        heightDots = Number(parts[0]) || heightDots;
        break;
      }

      case 'A': {
        // EPL2 text field grammar: <x>,<y>,<rotationCode 0-3>,<font>,<hMul>,<vMul>,<N|R>,"<data>"
        const match = line.match(/^A(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),([NR]),"([^"]*)"/);
        if (match) {
          elements.push({
            type: 'text',
            content: match[8],
            options: {
              x: Number(match[1]),
              y: Number(match[2]),
              rotation: eplRotationFromCode(Number(match[3])),
              font: match[4],
              size: Number(match[5]),
              reverse: match[7] === 'R' || undefined,
            },
          });
        }
        break;
      }

      case 'X': {
        // EPL2 box field grammar: <x1>,<y1>,<x2>,<y2>,<thickness>
        const parts = rest.split(',').map(Number);
        if (parts.length >= 5) {
          elements.push({
            type: 'box',
            options: {
              x: parts[0],
              y: parts[1],
              width: parts[2] - parts[0],
              height: parts[3] - parts[1],
              thickness: parts[4],
            },
          });
        }
        break;
      }

      case 'L': {
        // EPL2 "LO" solid-bar field grammar: <x>,<y>,<width>,<height>
        if (rest.startsWith('O')) {
          const parts = rest.slice(1).split(',').map(Number);
          if (parts.length >= 4) {
            elements.push({
              type: 'line',
              options: {
                x1: parts[0],
                y1: parts[1],
                x2: parts[0] + parts[2],
                y2: parts[1] + (parts[3] > parts[2] ? parts[3] : 0),
                thickness: Math.min(parts[2], parts[3]),
              },
            });
          }
        }
        break;
      }

      case 'P': {
        // Print
        break;
      }

      case 'B': // 1D barcode field — decoded structurally by EplCompiler's own barcode case, not here
      case 'b': // 2D barcode field — same as above, for qrcode
      case 'G': // graphic image data (GW) — decoded via a separate image element, not here
      case 'S': // print speed
      case 'D': // print darkness
      case 'R': // label reference/offset
      case 'Z': // print direction / orientation
      case 'O': // printer configuration options
      case 'J': // label gap/black-mark feed adjustment
      case 'f': // feed one label
      case 'r': // sensor mode (gap vs. black mark)
      case 'I': // printer information query
      case 'U': // printer status query
      case 'W': // Windows driver compatibility mode
      case 'e': // error-report enable/disable
      case 'E': // downloaded soft font management
      case 'F': // stored label format management
      case 'K': // delete a stored file
      case 'M': // buffer/memory size configuration
      case 'V': // stored numeric variable
      case 'C': // print counter field
        break;
    }
  }

  return { commands, widthDots, heightDots, elements, warnings };
}

/** Decodes EPL2 source into structured commands (line-based, one command per line). */
export class EplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseEPL(code);
  }
}
