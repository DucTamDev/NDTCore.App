import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { BarcodeSymbology } from '../../barcode';
import type { QrErrorCorrectionLevel } from '../../qrcode';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../builder/content/TextElement';
import type { LineOptions } from '../../builder/drawing/LineElement';
import { ZPL_COMMAND } from './ZplCommand';
import { encodeZplBitmapPayload } from './ZplEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

/** `^A`/`^B`/`^BQ` orientation letter for a given `Rotation`, per the Zebra ZPL II Programming Guide's field-orientation parameter (N=normal, R=90° CW, I=180°, B=270° CW). */
function zplOrientation(rotation: Rotation | undefined): string {
  switch (rotation) {
    case 90:
      return 'R';
    case 180:
      return 'I';
    case 270:
      return 'B';
    default:
      return 'N';
  }
}

const DEFAULT_FONT = '0';
/** `^A` font height, in dots, per one `TextOptions.size` unit — matches portakal's `(size ?? 1) * 30`. */
const FONT_HEIGHT_UNIT = 30;
/** `^FB`'s max-lines field — portakal hard-codes an effectively-unbounded line count rather than tracking a real limit. */
const MAX_FIELD_BLOCK_LINES = 999;

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const orientation = zplOrientation(o.rotation);
  const font = o.font ?? DEFAULT_FONT;
  const h = (o.size ?? 1) * FONT_HEIGHT_UNIT;
  const w = o.xScale ?? h;

  let cmd = `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}`;
  cmd += `^A${font}${orientation},${h},${w}`;

  if (o.maxWidth) {
    const justify = o.align === 'center' ? 'C' : o.align === 'right' ? 'R' : 'L';
    cmd += `${ZPL_COMMAND.FIELD_BLOCK}${o.maxWidth},${MAX_FIELD_BLOCK_LINES},0,${justify}`;
  }

  if (o.reverse) cmd += ZPL_COMMAND.FIELD_REVERSE;

  cmd += `${ZPL_COMMAND.FIELD_DATA}${content}${ZPL_COMMAND.FIELD_SEPARATOR}`;
  return cmd;
}

/** ZPL corner-radius index (0-8, per `^GB`'s trailing field) closest to a dot radius, relative to the shorter side of the box. */
const MAX_CORNER_INDEX = 8;

function zplCornerIndex(radiusDots: number | undefined, width: number, height: number): number {
  const maxR = Math.min(width, height) / 2;
  if (!radiusDots || maxR <= 0) return 0;
  return Math.min(MAX_CORNER_INDEX, Math.round((radiusDots / maxR) * MAX_CORNER_INDEX));
}

/**
 * `^GD` diagonal-line emission, shared by the `'line'` case's non-axis-
 * aligned fallback and the `'diagonal'` case itself — same "moved here as-is"
 * precedent `TscCompiler.ts` follows for its own `DIAGONAL` command.
 */
function compileDiagonal(o: LineOptions): string {
  const t = o.thickness ?? 1;
  const w = Math.abs(o.x2 - o.x1);
  const h = Math.abs(o.y2 - o.y1);
  const dir = o.x2 > o.x1 === o.y2 > o.y1 ? 'R' : 'L';
  return `${ZPL_COMMAND.FIELD_ORIGIN}${Math.min(o.x1, o.x2)},${Math.min(o.y1, o.y2)}${ZPL_COMMAND.GRAPHIC_DIAGONAL}${w},${h},${t},B,${dir}${ZPL_COMMAND.FIELD_SEPARATOR}`;
}

/** ZPL `^B<letter>` symbology letter per `BarcodeSymbology`, per the Zebra ZPL II Programming Guide's Bar Code Field commands. Net new — portakal never compiles a barcode element. */
const ZPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '3',
  code93: 'A',
  code128: 'C',
  ean8: '8',
  ean13: 'E',
  upca: 'U',
  upce: '9',
  itf: '2',
  codabar: 'K',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_MODULE_WIDTH = 2;
/** `^BY`'s wide-to-narrow ratio field — unused by Code 128/Code 93 per the spec, so only derived when both bar widths are given; 3 is the Programming Guide's own default. */
const DEFAULT_WIDE_NARROW_RATIO = 3;

const DEFAULT_QR_MAGNIFICATION = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
/** `^BQ`'s model field — model 2 is the current, recommended QR model per the Programming Guide. */
const QR_MODEL = 2;
/** `^FD` data-field prefix for `^BQ`'s "automatic" input mode (vs. manual field-by-field encoding). */
const QR_MODE_AUTO = 'A';

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines. Table rows are compiled via `compileTextElement` with no font
 * override, so they render at `DEFAULT_FONT` ("0") and `FONT_HEIGHT_UNIT`'s
 * 1x height (30 dots) — kept as one named constant, reusing that same value,
 * for the same consistency reason `TscCompiler`'s
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` documents.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = FONT_HEIGHT_UNIT;

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const totalBytes = bmp.data.length;
      const hex = encodeZplBitmapPayload(bmp);
      return `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}${ZPL_COMMAND.GRAPHIC_FIELD_ASCII},${totalBytes},${totalBytes},${bmp.bytesPerRow},${hex}${ZPL_COMMAND.FIELD_SEPARATOR}`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const rIndex = zplCornerIndex(o.radius, o.width, o.height);
      return `${ZPL_COMMAND.FIELD_ORIGIN}${o.x},${o.y}${ZPL_COMMAND.GRAPHIC_BOX}${o.width},${o.height},${t},B,${rIndex}${ZPL_COMMAND.FIELD_SEPARATOR}`;
    }

    // Axis-aligned only — a genuinely diagonal line is the separate
    // `'diagonal'` case below. `PrintBuilder.line()` always dispatches via
    // `isDiagonal()` so it never produces a `'line'` element with diagonal
    // coordinates, but a hand-built `PrintElement` literal could bypass that
    // guarantee — the fallback below covers that case defensively (reusing
    // the same `^GD` emission the `'diagonal'` case uses), same precedent as
    // `TscCompiler.ts`'s `'line'`/`'diagonal'` split.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) {
        const w = Math.abs(o.x2 - o.x1);
        return `${ZPL_COMMAND.FIELD_ORIGIN}${Math.min(o.x1, o.x2)},${o.y1}${ZPL_COMMAND.GRAPHIC_BOX}${w},${t},${t}${ZPL_COMMAND.FIELD_SEPARATOR}`;
      }
      if (o.x1 === o.x2) {
        const h = Math.abs(o.y2 - o.y1);
        return `${ZPL_COMMAND.FIELD_ORIGIN}${o.x1},${Math.min(o.y1, o.y2)}${ZPL_COMMAND.GRAPHIC_BOX}${t},${h},${t}${ZPL_COMMAND.FIELD_SEPARATOR}`;
      }
      return compileDiagonal(o);
    }

    case 'diagonal':
      return compileDiagonal(element.options);

    case 'circle': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `${ZPL_COMMAND.FIELD_ORIGIN}${o.x},${o.y}${ZPL_COMMAND.GRAPHIC_CIRCLE}${o.diameter},${t},B${ZPL_COMMAND.FIELD_SEPARATOR}`;
    }

    // No native ZPL command for an ellipse outline, a standalone
    // reverse-print region, or a standalone erase region — documented no-op,
    // matching portakal's own `compileToZPL()` (which returns `''` for all
    // three) rather than inventing new command grammar for them.
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // `CutOptions.rows` (cut after every N labels) has no ZPL equivalent —
    // `^MM` cutter mode cuts after every label once active, unlike TSPL's
    // `SET CUTTER n`, so it's intentionally not read here.
    case 'cut': {
      const mode = element.options?.mode ?? 'full';
      return mode === 'off' ? `${ZPL_COMMAND.PRINT_MODE}T` : `${ZPL_COMMAND.PRINT_MODE}C`;
    }

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `TscCompiler`'s/`EscPosCompiler`'s
    // `'table'` case uses), then emit each line as its own text field,
    // stacked one `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the
    // table's own y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const rowLines = formatTable(o.columns, o.rows, totalWidth);
      return rowLines.map((line, i) => compileTextElement(line, { x, y: y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS })).join('\n');
    }

    // Neither ZPL nor this package has a native "page break" / "advance the
    // cursor by N dots" / "lay out children in a row-or-column" primitive —
    // documented no-op, same precedent as `TscCompiler`'s/`EscPosCompiler`'s
    // equivalent cases, pending a real auto-layout design (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal (it never compiles barcode/qrcode elements for ZPL
    // either) — derived from `parsers/zpl.ts`'s `^B*`-family decode logic
    // (the `^BY`/`^B<type>` grammar it recognizes) as ground truth, same
    // approach used for TSC's equivalent gap.
    case 'barcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const type = ZPL_BARCODE_TYPE[c.symbology];
      const height = c.height ?? DEFAULT_BARCODE_HEIGHT;
      const readable = c.readable ? 'Y' : 'N';
      const orientation = zplOrientation(c.rotation);
      const narrow = c.narrowBarWidth ?? DEFAULT_MODULE_WIDTH;
      const ratio = c.narrowBarWidth && c.wideBarWidth ? Math.round(c.wideBarWidth / c.narrowBarWidth) : DEFAULT_WIDE_NARROW_RATIO;
      return `${ZPL_COMMAND.BARCODE_FIELD_DEFAULT}${narrow},${ratio},${height}${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}^B${type}${orientation},${height},${readable}${ZPL_COMMAND.FIELD_DATA}${c.content}${ZPL_COMMAND.FIELD_SEPARATOR}`;
    }

    // `^BQ`'s field-orientation parameter reliably supports only "N" on real
    // firmware (unlike `^A`/`^B<type>`'s full N/R/I/B set) per the Zebra ZPL
    // II Programming Guide, so `rotation` isn't applied here — a documented
    // gap, not a silent drop.
    case 'qrcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const magnification = c.cellWidth ?? DEFAULT_QR_MAGNIFICATION;
      const ecc = c.errorCorrection ?? DEFAULT_QR_ECC;
      return `${ZPL_COMMAND.FIELD_ORIGIN}${x},${y}^BQN,${QR_MODEL},${magnification}${ZPL_COMMAND.FIELD_DATA}${ecc}${QR_MODE_AUTO},${c.content}${ZPL_COMMAND.FIELD_SEPARATOR}`;
    }
  }
}

/** ZPL darkness (`~SD`, 0-30) per one `ResolvedPrintDocument.density` unit (0-15, shared across languages) — portakal's own `density * 2` mapping. */
const DARKNESS_SCALE = 2;

/** Compiles a `ResolvedPrintDocument` into a ZPL II command string. */
export function compileToZPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(ZPL_COMMAND.START_FORMAT);
  lines.push(`${ZPL_COMMAND.PRINT_WIDTH}${document.widthDots}`);
  if (document.heightDots > 0) {
    lines.push(`${ZPL_COMMAND.LABEL_LENGTH}${document.heightDots}`);
  }
  lines.push(`${ZPL_COMMAND.PRINT_RATE}${document.speed}`);
  lines.push(`${ZPL_COMMAND.DARKNESS}${document.density * DARKNESS_SCALE}`);
  lines.push(`${ZPL_COMMAND.CHANGE_INTL_FONT_ENCODING}28`);

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\n`-joined output.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${ZPL_COMMAND.PRINT_QUANTITY}${document.copies}`);
  lines.push(ZPL_COMMAND.END_FORMAT);
  return lines.join('\n') + '\n';
}

/**
 * ZPL has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to satisfy
 * `PrintCompiler`'s shared call shape and isn't otherwise used.
 */
export class ZplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToZPL(document);
  }
}
