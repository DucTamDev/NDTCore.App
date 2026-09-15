import type { PrintParser } from '../../core';
import type { PrintElement } from '../../builder';
import type { Alignment } from '../../types';

/**
 * One decoded ZPL command: its `^`/`~`-prefixed code, the raw text between
 * it and the next command, and that text split on `,` for callers that want
 * positional parameters. Unlike TSPL's `TSPLCommand` (a discriminated union
 * per command), ZPL's own grammar doesn't warrant one — `tokenize()` never
 * needs to know a command's parameter shape to split it from its neighbors,
 * so every command decodes to this one generic shape, matching portakal's
 * `ZPLCommand` interface in `parsers/zpl.ts`.
 */
export interface ZPLCommand {
  code: string;
  rawParams: string;
  params: string[];
}

/** Full result of parsing a ZPL II source string. */
export interface ZPLParseResult {
  commands: ZPLCommand[];
  widthDots: number;
  heightDots: number;
  elements: PrintElement[];
  warnings: string[];
}

const DEFAULT_WIDTH_DOTS = 812; // 4in @ 203dpi
const DEFAULT_HEIGHT_DOTS = 1218; // 6in @ 203dpi

/**
 * Tokenizes ZPL source into `{code, rawParams, params}` commands. Every
 * command starts with `^` or `~`; most run until the next `^`/`~`, but three
 * codes need their own read rule because their payload can itself contain
 * those characters: `^FD`/`^FV` (field data) runs until the literal `^FS`
 * marker, `^GF`/`~DG` (graphic field data) and `^FX` (comment) run until the
 * next `^`/`~` same as normal params but are called out separately below to
 * mirror portakal's own branch order — reordering these checks would change
 * which branch a line falls into.
 */
export function tokenize(code: string): ZPLCommand[] {
  const commands: ZPLCommand[] = [];
  let i = 0;

  while (i < code.length) {
    if (code[i] === ' ' || code[i] === '\r' || code[i] === '\n' || code[i] === '\t') {
      i++;
      continue;
    }

    if (code[i] === '^' || code[i] === '~') {
      const prefix = code[i];
      i++;

      let cmdCode = prefix;
      if (i < code.length && /[A-Za-z]/.test(code[i])) {
        cmdCode += code[i].toUpperCase();
        i++;
      }
      if (i < code.length && /[A-Za-z0-9@]/.test(code[i])) {
        cmdCode += code[i].toUpperCase();
        i++;
      }

      let rawParams = '';

      if (cmdCode === '^FD' || cmdCode === '^FV') {
        const endMarker = '^FS';
        const endIdx = code.indexOf(endMarker, i);
        if (endIdx >= 0) {
          rawParams = code.slice(i, endIdx).trim();
          i = endIdx; // ^FS is tokenized as the next command.
        } else {
          rawParams = code.slice(i).trim();
          i = code.length;
        }
      } else if (cmdCode === '^GF' || cmdCode === '~DG' || cmdCode === '^FX') {
        const start = i;
        while (i < code.length && code[i] !== '^' && code[i] !== '~') i++;
        rawParams = code.slice(start, i).trim();
      } else {
        const start = i;
        while (i < code.length && code[i] !== '^' && code[i] !== '~') {
          if (code[i] === '\r' || code[i] === '\n') break;
          i++;
        }
        rawParams = code.slice(start, i).trim();
      }

      const params = rawParams ? rawParams.split(',').map((s) => s.trim()) : [];
      commands.push({ code: cmdCode, rawParams, params });
    } else {
      i++;
    }
  }

  return commands;
}

/**
 * Parses ZPL II source into structured commands plus preview-renderable
 * `PrintElement`s. Field state (position, font, reverse, barcode defaults)
 * accumulates across `^FO`/`^FT`...`^FS` — mirroring portakal's
 * `parseZPL()` state machine field-for-field, including the ordering
 * `^A`/`^B` generic-prefix checks run in ahead of the main `switch`.
 *
 * Two pieces of portakal's own tracked state (`^A`'s orientation letter,
 * `^FB`'s max-lines field) are read but never applied to any emitted
 * element there either — dropped here rather than carried as dead state,
 * with no change to what a `parseZPL()` caller observes.
 */
export function parseZPL(code: string): ZPLParseResult {
  const commands = tokenize(code);
  const elements: PrintElement[] = [];
  const warnings: string[] = [];
  let widthDots = DEFAULT_WIDTH_DOTS;
  let heightDots = DEFAULT_HEIGHT_DOTS;

  let fieldX = 0;
  let fieldY = 0;
  let labelHomeX = 0;
  let labelHomeY = 0;
  let labelShift = 0;
  let labelTop = 0;
  let currentFont = '0';
  let currentFontH = 30;
  let currentFontW = 30;
  let fieldReverse = false;
  let fieldData = '';
  let barcodeType = '';
  let barcodeHeight = 10; // matches ^BY's own fallback when no ^BY command has run yet
  let barcodeModuleWidth = 2; // matches ^BY's own fallback when no ^BY command has run yet
  let fieldBaseline = false;
  let fieldBlockWidth = 0;
  let fieldBlockJustify = 'L';

  for (const cmd of commands) {
    // `^A0`/`^AA`.../`^AZ` — font letter is part of the command code itself.
    if (cmd.code.startsWith('^A') && cmd.code.length === 3 && cmd.code !== '^A@') {
      currentFont = cmd.code[2];
      const parts = cmd.rawParams.split(',');
      if (parts[1]) {
        currentFontH = Number(parts[1]) || currentFontH;
        currentFontW = parts[2] ? Number(parts[2]) || currentFontH : currentFontH;
      }
      continue;
    }

    // `^B0`-`^B9`/`^BA`-`^BZ` — barcode type is part of the command code itself, except `^BY` (bar code field default, handled in the switch).
    if (cmd.code.startsWith('^B') && cmd.code.length === 3 && cmd.code !== '^BY') {
      barcodeType = cmd.code;
      if (cmd.params[1]) {
        const h = Number(cmd.params[1]);
        if (h > 0) barcodeHeight = h;
      }
      continue;
    }

    switch (cmd.code) {
      case '^XA':
        fieldX = 0;
        fieldY = 0;
        fieldReverse = false;
        break;

      case '^XZ':
        break;

      case '^PW':
        if (cmd.params[0]) widthDots = Number(cmd.params[0]);
        break;

      case '^LL':
        if (cmd.params[0]) heightDots = Number(cmd.params[0]);
        break;

      case '^LH':
        labelHomeX = Number(cmd.params[0] ?? 0);
        labelHomeY = Number(cmd.params[1] ?? 0);
        break;

      case '^LS':
        labelShift = Number(cmd.params[0] ?? 0);
        break;

      case '^LT':
        labelTop = Number(cmd.params[0] ?? 0);
        break;

      case '^LR':
      case '^PQ':
      case '^PR':
      case '^MD':
      case '~SD':
      case '^MM':
      case '^MT':
      case '^MN':
      case '^PO':
      case '^PM':
      case '^MU':
        break;

      case '^FO':
        fieldX = Number(cmd.params[0] ?? 0) + labelHomeX + labelShift;
        fieldY = Number(cmd.params[1] ?? 0) + labelHomeY + labelTop;
        fieldReverse = false;
        fieldBaseline = false;
        fieldBlockWidth = 0;
        break;

      // `^FT` positions by baseline (bottom of text) rather than top-left — converted back to top-left when the field closes, below.
      case '^FT':
        fieldX = Number(cmd.params[0] ?? 0) + labelHomeX + labelShift;
        fieldY = Number(cmd.params[1] ?? 0) + labelHomeY + labelTop;
        fieldBaseline = true;
        fieldBlockWidth = 0;
        break;

      case '^FD':
      case '^FV':
        fieldData = cmd.rawParams;
        break;

      case '^FS': {
        if (fieldData) {
          const adjustedY = fieldBaseline ? fieldY - currentFontH : fieldY;

          if (barcodeType) {
            // No dedicated barcode `PrintElement` shape exists on the parse
            // side (unlike `ZplCompiler`'s dedicated `barcode`/`qrcode`
            // cases) — captured as `raw` ZPL text instead, same as portakal.
            elements.push({
              type: 'raw',
              content: `^BY${barcodeModuleWidth}^FO${fieldX},${adjustedY}${barcodeType}N,${barcodeHeight},Y^FD${fieldData}^FS`,
            });
            barcodeType = '';
          } else {
            const align: Alignment | undefined =
              fieldBlockWidth > 0 && fieldBlockJustify === 'C' ? 'center' : fieldBlockWidth > 0 && fieldBlockJustify === 'R' ? 'right' : undefined;
            elements.push({
              type: 'text',
              content: fieldData,
              options: {
                x: fieldX,
                y: adjustedY,
                font: currentFont,
                size: 1,
                xScale: currentFontW,
                yScale: currentFontH,
                reverse: fieldReverse || undefined,
                maxWidth: fieldBlockWidth || undefined,
                align,
              },
            });
          }
          fieldData = '';
        }
        fieldReverse = false;
        fieldBaseline = false;
        break;
      }

      case '^FR':
        fieldReverse = true;
        break;

      case '^FN':
      case '^FH':
      case '^FP':
      case '^FW':
      case '^FX':
      case '^A@':
        break;

      case '^CF':
        if (cmd.params[0]) currentFont = cmd.params[0];
        if (cmd.params[1]) {
          currentFontH = Number(cmd.params[1]);
          currentFontW = cmd.params[2] ? Number(cmd.params[2]) : currentFontH;
        }
        break;

      case '^CI':
      case '^CW':
        break;

      // `^FBwidth,maxLines,lineSpacing,justify,hangingIndent` — `maxLines`/`lineSpacing`/`hangingIndent` aren't read since nothing downstream consumes them (same gap portakal's own parser has).
      case '^FB':
        fieldBlockWidth = Number(cmd.params[0] ?? 0);
        fieldBlockJustify = (cmd.params[3] ?? 'L').toUpperCase();
        break;

      case '^TB':
        break;

      // `^BYw,r,h` — bar code field default; `r` (wide-to-narrow ratio) isn't tracked, same as portakal (unused for Code 128, and never read back out downstream here either).
      case '^BY':
        if (cmd.params[0]) barcodeModuleWidth = Number(cmd.params[0]) || barcodeModuleWidth;
        if (cmd.params[2]) barcodeHeight = Number(cmd.params[2]) || barcodeHeight;
        break;

      case '^GB': {
        const w = Number(cmd.params[0] ?? 1);
        const h = Number(cmd.params[1] ?? 1);
        const t = Number(cmd.params[2] ?? 1);
        const color = (cmd.params[3] ?? 'B').toUpperCase();
        const rIndex = Number(cmd.params[4] ?? 0);
        const r = rIndex > 0 ? (rIndex / 8) * (Math.min(w, h) / 2) : 0;
        // `^FR` XORs the field (black<->white); color `W` also inverts.
        const isWhite = fieldReverse ? color !== 'W' : color === 'W';
        const isFilled = t >= Math.min(w, h);
        if (isWhite && isFilled) {
          elements.push({ type: 'erase', options: { x: fieldX, y: fieldY, width: w, height: h } });
        } else {
          elements.push({ type: 'box', options: { x: fieldX, y: fieldY, width: w, height: h, thickness: t, radius: r } });
        }
        fieldReverse = false;
        break;
      }

      case '^GC': {
        const d = Number(cmd.params[0] ?? 1);
        const t = Number(cmd.params[1] ?? 1);
        const color = (cmd.params[2] ?? 'B').toUpperCase();
        const isWhite = fieldReverse ? color !== 'W' : color === 'W';
        if (isWhite && t >= d / 2) {
          elements.push({ type: 'erase', options: { x: fieldX, y: fieldY, width: d, height: d } });
        } else {
          elements.push({ type: 'circle', options: { x: fieldX, y: fieldY, diameter: d, thickness: t } });
        }
        fieldReverse = false;
        break;
      }

      // `^GD` is inherently diagonal (unlike TSPL's `BAR`, which can also
      // draw an axis-aligned line) — maps straight to this package's
      // `'diagonal'` `PrintElement`, the same adaptation `TscParser` makes
      // for its own `DIAGONAL` command.
      case '^GD': {
        const w = Number(cmd.params[0] ?? 1);
        const h = Number(cmd.params[1] ?? 1);
        const t = Number(cmd.params[2] ?? 1);
        const dir = (cmd.params[4] ?? 'R').toUpperCase();
        if (dir === 'R') {
          elements.push({ type: 'diagonal', options: { x1: fieldX, y1: fieldY, x2: fieldX + w, y2: fieldY + h, thickness: t } });
        } else {
          elements.push({ type: 'diagonal', options: { x1: fieldX + w, y1: fieldY, x2: fieldX, y2: fieldY + h, thickness: t } });
        }
        fieldReverse = false;
        break;
      }

      case '^GE':
      case '^GF':
      case '^GS':
      case '~DG':
      case '^ID':
      case '^IL':
      case '^IM':
      case '^IS':
      case '^XG':
      case '^DF':
      case '^XF':
      case '^SN':
      case '^JM':
      case '^JU':
      case '^JZ':
      case '^SZ':
      case '^SC':
      case '^SE':
      case '^SF':
      case '^SI':
      case '^SL':
      case '^SO':
      case '^SP':
      case '^SQ':
      case '^SR':
      case '^SS':
      case '^ST':
      case '^SX':
      case '~HI':
      case '~HS':
      case '~HM':
      case '~HU':
      case '~HB':
      case '~HD':
      case '~HQ':
      case '^HH':
      case '^HF':
      case '^HG':
      case '^HL':
      case '^HR':
      case '^HT':
      case '^HV':
      case '^HW':
      case '^HY':
      case '^HZ':
      case '^NC':
      case '^ND':
      case '^NI':
      case '^NN':
      case '^NP':
      case '^NS':
      case '^NT':
      case '^NW':
      case '~NC':
      case '~NR':
      case '~NT':
      case '^NB':
      case '^RF':
      case '^RL':
      case '^RB':
      case '^RS':
      case '^RU':
      case '^RW':
      case '^WD':
      case '^WA':
      case '^WE':
      case '^WL':
      case '^WP':
      case '^WR':
      case '^WS':
      case '^WX':
      case '~WC':
      case '~WL':
      case '~WQ':
      case '~WR':
      case '^MC':
      case '^MF':
      case '^MI':
      case '^ML':
      case '^MP':
      case '^MW':
      case '^MA':
      case '^CC':
      case '^CD':
      case '^CM':
      case '^CN':
      case '^CO':
      case '^CP':
      case '^CT':
      case '^CV':
      case '^FC':
      case '^FE':
      case '^FL':
      case '^FM':
      case '^JB':
      case '^JH':
      case '^JI':
      case '^JJ':
      case '^JS':
      case '^JT':
      case '^JW':
      case '^KC':
      case '^KD':
      case '^KL':
      case '^KN':
      case '^KP':
      case '^KV':
      case '^LF':
      case '^PA':
      case '^PF':
      case '^PH':
      case '^PN':
      case '^PP':
      case '^TO':
      case '^XB':
      case '^XS':
      case '^ZZ':
      case '~DB':
      case '~DE':
      case '~DN':
      case '~DS':
      case '~DT':
      case '~DU':
      case '~DY':
      case '~EG':
      case '~JA':
      case '~JB':
      case '~JC':
      case '~JD':
      case '~JE':
      case '~JF':
      case '~JG':
      case '~JI':
      case '~JL':
      case '~JN':
      case '~JO':
      case '~JP':
      case '~JQ':
      case '~JR':
      case '~JS':
      case '~JX':
      case '~KB':
      case '~PL':
      case '~PM':
      case '~PR':
      case '~PS':
      case '~RO':
      case '~TA':
        break;

      default:
        if (cmd.code !== '^FS') {
          warnings.push(`Unknown command: ${cmd.code}`);
        }
        break;
    }
  }

  return { commands, widthDots, heightDots, elements, warnings };
}

/** Decodes ZPL II source into structured commands (tokenized, per-command grammar). */
export class ZplParser implements PrintParser<{ commands: unknown[]; warnings: string[] }> {
  parse(source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
    const code = typeof source === 'string' ? source : new TextDecoder().decode(source);
    return parseZPL(code);
  }
}
