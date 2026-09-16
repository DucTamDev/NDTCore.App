import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../builder/content/TextElement';
import { IPL_COMMAND } from './IplCommand';
import { encodeIplBitmapPayload } from './IplEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

const { STX, ETX, ESC } = IPL_COMMAND;

/** Field-record rotation code (`0`-`3`, the `H`/`G` field's own `f` clause) for a given `Rotation`, matching portakal's `iplRotation()`. */
function iplRotation(rotation: Rotation | undefined): 0 | 1 | 2 | 3 {
  switch (rotation) {
    case 90:
      return 1;
    case 180:
      return 2;
    case 270:
      return 3;
    default:
      return 0;
  }
}

/** Font-size multiplier used for both the `H` field's `h` (height) and `w` (width) clauses when no explicit font is chosen — portakal always derives both from the same `size` value. */
const FONT_SIZE_UNIT_DOTS = 12;

/** Fixed font-id digit in the `H` field's `d` (data) clause — portakal never varies this. */
const TEXT_FONT_ID = 3;

function compileTextField(fieldNum: number, content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const rot = iplRotation(o.rotation);
  const size = (o.size ?? 1) * FONT_SIZE_UNIT_DOTS;
  return `${STX}${IPL_COMMAND.FIELD_TEXT}${fieldNum};o${x},${y};f${rot};h${size};w${size};c26;d${TEXT_FONT_ID},${content}${ETX}`;
}

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines into successive `H` field records. IPL's text field has no
 * font-metrics table to derive a real glyph height from (its `h`/`w`
 * clauses are a raw size multiplier, not a computed pixel height) — same
 * fallback-default role `DplCompiler.ts`'s `DEFAULT_TABLE_ROW_HEIGHT_DOTS`
 * serves for DPL.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

function compileElement(element: PrintElement, nextFieldNum: () => number): string {
  switch (element.type) {
    case 'text':
      return compileTextField(nextFieldNum(), element.content, element.options);

    // See `IplEncoder.ts`'s `encodeIplBitmapPayload()` doc comment for the
    // full confidence disclosure on this field's clause layout — LOW
    // confidence on the exact syntax, HIGH confidence that real payload
    // bytes now follow the header (portakal's own case emits neither
    // width, height, nor data at all).
    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const payload = encodeIplBitmapPayload(bmp);
      const fieldNum = nextFieldNum();
      return `${STX}${IPL_COMMAND.FIELD_GRAPHIC}${fieldNum};o${x},${y};f0;w${bmp.bytesPerRow};h${bmp.height};${payload}${ETX}`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const fieldNum = nextFieldNum();
      return `${STX}${IPL_COMMAND.FIELD_BOX}${fieldNum};o${o.x},${o.y};f0;l${o.width};h${o.height};w${t}${ETX}`;
    }

    // Axis-aligned only, ported as-is from portakal's own `languages/ipl.ts`
    // (which emits no field at all for a non-axis-aligned pair rather than
    // approximating one). `PrintBuilder.line()` always dispatches via
    // `isDiagonal()` so it never produces a `'line'` element with diagonal
    // coordinates in practice.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const fieldNum = nextFieldNum();
      if (o.y1 === o.y2) {
        const len = Math.abs(o.x2 - o.x1);
        return `${STX}${IPL_COMMAND.FIELD_LINE}${fieldNum};o${Math.min(o.x1, o.x2)},${o.y1};f0;l${len};w${t}${ETX}`;
      }
      if (o.x1 === o.x2) {
        const len = Math.abs(o.y2 - o.y1);
        return `${STX}${IPL_COMMAND.FIELD_LINE}${fieldNum};o${o.x1},${Math.min(o.y1, o.y2)};f1;l${len};w${t}${ETX}`;
      }
      return '';
    }

    // IPL's Line field has no diagonal capability (only the axis-aligned
    // origin/length record `'line'` compiles above) — documented no-op,
    // same precedent `DplCompiler`'s/`EplCompiler`'s `'diagonal'` case sets.
    case 'diagonal':
      return '';

    // No native IPL command for a circle, ellipse outline, standalone
    // reverse-print region, or standalone erase region — documented no-op,
    // matching portakal's own `compileElement()` (which returns nothing for
    // all four) rather than inventing new field grammar for them.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // No documented native IPL cutter command — portakal's own
    // `languages/ipl.ts` has zero cut-related logic to port. Documented
    // no-op, same precedent as `DplCompiler`'s `'cut'` case.
    case 'cut':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper every language compiler's `'table'` case
    // uses), then emit each line as its own `H` field record, stacked one
    // `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the table's own y —
    // each row gets its own field number via `nextFieldNum()`, since IPL
    // field numbers identify distinct fields within a format.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const rowLines = formatTable(o.columns, o.rows, totalWidth);
      return rowLines.map((line, i) => compileTextField(nextFieldNum(), line, { x, y: y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS })).join('\r\n');
    }

    // Neither IPL nor this package has a native "page break" / "advance the
    // cursor by N dots" / "lay out children in a row-or-column" primitive —
    // documented no-op, same precedent as `DplCompiler`'s/`ZplCompiler`'s
    // equivalent cases, pending a real auto-layout design (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal (`parsers/ipl.ts` recognizes a `B`-prefixed field only
    // as an opaque `FIELD_B` command — it never decodes symbology, module
    // width, or any other barcode parameter) and there's no genuine
    // external anchor to derive a type-selection table or record shape
    // from here either. Documented no-op instead, consistent with how this
    // same file already treats every other genuinely-undocumented IPL
    // capability (`circle`/`ellipse`/`reverse`/`erase` above): honest
    // absence of information, not an invented plausible-looking record.
    case 'barcode':
    case 'qrcode':
      return '';
  }
}

/** Compiles a `ResolvedPrintDocument` into an Intermec/Honeywell IPL command string. */
export function compileToIPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(`${STX}${ESC}${IPL_COMMAND.CREATE_FORMAT}${ETX}`);
  lines.push(`${STX}${ESC}${IPL_COMMAND.PROGRAM_MODE}${ETX}`);

  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_LENGTH}${document.heightDots > 0 ? document.heightDots : 400}${ETX}`);
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_WIDTH}${document.widthDots}${ETX}`);
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_SPEED}${document.speed}0${ETX}`);
  lines.push(`${STX}<SI>${IPL_COMMAND.CONFIG_DENSITY}${document.density}${ETX}`);

  let fieldCounter = 0;
  const nextFieldNum = (): number => ++fieldCounter;

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\r\n`-joined output.
    const line = compileElement(element, nextFieldNum);
    if (line) lines.push(line);
  }

  lines.push(`${STX}${IPL_COMMAND.PRINT}${ETX}`);
  if (document.copies > 1) {
    lines.push(`${STX}${ESC}${IPL_COMMAND.COPIES}${document.copies}${ETX}`);
  }
  lines.push(`${STX}${ESC}${IPL_COMMAND.END_FORMAT}${ETX}`);

  return lines.join('\r\n') + '\r\n';
}

/**
 * IPL has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to
 * satisfy `PrintCompiler`'s shared call shape and isn't otherwise used.
 *
 * Known limitation — same mixed string encoding constraint as
 * `DplCompiler.compile()`'s doc comment describes: when an `image` element
 * is present, the returned string interleaves ordinary text (UTF-8-intended)
 * with the Graphic field's raw-binary payload (one JS char code = one raw
 * byte, from `encodeIplBitmapPayload`). A caller turning this string into
 * wire bytes must not run it through a naive UTF-8 encoder when the
 * document contains an image element.
 */
export class IplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToIPL(document);
  }
}
