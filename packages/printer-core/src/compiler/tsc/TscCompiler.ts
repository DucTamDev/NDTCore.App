import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { BarcodeSymbology } from '../../barcode';
import type { QrErrorCorrectionLevel } from '../../qrcode';
import type { TextOptions } from '../../builder/content/TextElement';
import { TSC_COMMAND } from './TscCommand';
import { encodeTscBitmapPayload } from './TscEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

const MM_PER_INCH = 25.4;

const DEFAULT_FONT = '2';
const DEFAULT_ROTATION = 0;

/** TSPL2 barcode "code type" string per symbology, per the TSPL/TSPL2 Programming Manual's `BARCODE` command table. */
const TSC_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '39',
  code93: '93',
  code128: '128',
  ean8: 'EAN8',
  ean13: 'EAN13',
  upca: 'UPCA',
  upce: 'UPCE',
  itf: 'ITF',
  codabar: 'CODA',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_WIDE_BAR = 2;
const DEFAULT_QR_CELL_WIDTH = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
/** TSPL2 `QRCODE` mode field: "A" (auto — printer picks the encoding mode) vs "M" (manual). Always auto here, same as this repo's own `TsplEncoder.qrcode()`. */
const QR_MODE_AUTO = 'A';

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines. Derived from `DEFAULT_FONT` ("2")'s glyph height on the TSPL
 * built-in bitmap font table — same 20-dot figure `TscPreviewRenderer`'s
 * `TSC_FONTS['2'].h` uses, kept consistent since table rows are compiled via
 * `compileTextElement` with no explicit font override (so they render at
 * `DEFAULT_FONT`).
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 20;

/** Default number of labels to feed before cutting when `CutOptions.rows` is omitted — cut after every 1 label. */
const DEFAULT_CUT_ROWS = 1;

/**
 * Escapes a value for embedding inside a double-quoted TSPL string parameter
 * (e.g. `TEXT`/`BLOCK`/`BARCODE`/`QRCODE`'s trailing `"content"` field).
 *
 * Backslash-escapes literal `"` so user content (a product name, a label
 * field) can't close the TSPL string early — an unescaped quote there would
 * corrupt the command grammar and let the remainder of the content be
 * reinterpreted as further TSPL parameters. `\r`/`\n` are replaced with a
 * space for the same reason: this compiler joins one command per line with
 * `\r\n` (see `compileToTSC`), so an embedded newline could otherwise start
 * a new line the printer treats as its own TSPL command.
 */
function escapeTsplString(content: string): string {
  return content.replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
}

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const font = o.font ?? DEFAULT_FONT;
  const rotation = o.rotation ?? DEFAULT_ROTATION;
  const xMul = o.xScale ?? o.size ?? 1;
  const yMul = o.yScale ?? o.size ?? 1;
  const escaped = escapeTsplString(content);

  if (o.maxWidth) {
    const align = o.align === 'center' ? 2 : o.align === 'right' ? 3 : 1;
    const spacing = o.lineSpacing ?? 0;
    return `${TSC_COMMAND.BLOCK} ${x},${y},${o.maxWidth},${o.maxWidth},"${font}",${rotation},${xMul},${yMul},${spacing},${align},"${escaped}"`;
  }

  return `${TSC_COMMAND.TEXT} ${x},${y},"${font}",${rotation},${xMul},${yMul},"${escaped}"`;
}

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const payload = encodeTscBitmapPayload(bmp);
      return `${TSC_COMMAND.BITMAP} ${x},${y},${bmp.bytesPerRow},${bmp.height},0,${payload}`;
    }

    case 'box': {
      const o = element.options;
      const x2 = o.x + o.width;
      const y2 = o.y + o.height;
      const t = o.thickness ?? 1;
      if (o.radius) {
        return `${TSC_COMMAND.BOX} ${o.x},${o.y},${x2},${y2},${t},${o.radius}`;
      }
      return `${TSC_COMMAND.BOX} ${o.x},${o.y},${x2},${y2},${t}`;
    }

    // Axis-aligned only — a genuinely diagonal line is a separate `diagonal`
    // element/case below (see `DiagonalElement` in `builder/PrintElement.ts`).
    // `PrintBuilder.line()` always dispatches via `isDiagonal()` so it never
    // produces a `'line'` element with diagonal coordinates, but a hand-built
    // `PrintElement` literal could bypass that guarantee — the fallback below
    // covers that case defensively (reusing the same `DIAGONAL` emission the
    // `'diagonal'` case uses) instead of silently emitting an incorrect
    // vertical `BAR`.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) {
        const w = Math.abs(o.x2 - o.x1);
        return `${TSC_COMMAND.BAR} ${Math.min(o.x1, o.x2)},${o.y1},${w},${t}`;
      }
      if (o.x1 === o.x2) {
        const h = Math.abs(o.y2 - o.y1);
        return `${TSC_COMMAND.BAR} ${o.x1},${Math.min(o.y1, o.y2)},${t},${h}`;
      }
      return `${TSC_COMMAND.DIAGONAL} ${o.x1},${o.y1},${o.x2},${o.y2},${t}`;
    }

    // The non-axis-aligned case `'line'` used to fall back to — moved here as-is.
    case 'diagonal': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `${TSC_COMMAND.DIAGONAL} ${o.x1},${o.y1},${o.x2},${o.y2},${t}`;
    }

    case 'circle': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `${TSC_COMMAND.CIRCLE} ${o.x},${o.y},${o.diameter},${t}`;
    }

    case 'ellipse': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `${TSC_COMMAND.ELLIPSE} ${o.x},${o.y},${o.width},${o.height},${t}`;
    }

    case 'reverse': {
      const o = element.options;
      return `${TSC_COMMAND.REVERSE} ${o.x},${o.y},${o.width},${o.height}`;
    }

    case 'erase': {
      const o = element.options;
      return `${TSC_COMMAND.ERASE} ${o.x},${o.y},${o.width},${o.height}`;
    }

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    /**
     * `SET CUTTER` — see `TSC_COMMAND.SET_CUTTER`'s doc comment for why this
     * follows `TsplEncoder.cut()`'s exact grammar (no `BATCH` keyword) rather
     * than inventing one. `'full'`/`'partial'` are not distinguished — TSPL's
     * cutter has no partial-cut concept, unlike ESC/POS's `GS V`.
     */
    case 'cut': {
      const mode = element.options?.mode ?? 'full';
      if (mode === 'off') return `${TSC_COMMAND.SET_CUTTER} OFF`;
      const rows = element.options?.rows ?? DEFAULT_CUT_ROWS;
      return `${TSC_COMMAND.SET_CUTTER} ${rows}`;
    }

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `EscPosCompiler`'s `'table'` case uses),
    // then emit each line as its own `TSC_COMMAND.TEXT` command, stacked one
    // `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the table's own y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const rowLines = formatTable(o.columns, o.rows, totalWidth);
      return rowLines.map((line, i) => compileTextElement(line, { x, y: y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS })).join('\r\n');
    }

    // Neither TSPL nor this package has a native "page break" / "advance the
    // cursor by N dots" / "lay out children in a row-or-column" primitive —
    // documented no-op, same precedent as `EscPosCompiler`'s equivalent
    // cases, pending a real auto-layout design (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal (it never compiles barcode/qrcode elements) — derived
    // directly from the TSPL/TSPL2 Programming Manual's `BARCODE`/`QRCODE`
    // command grammar, same ground-truth approach EscPosBarcodeEncoder/
    // EscPosQrCodeEncoder used for ESC/POS's equivalent gap.
    case 'barcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const type = TSC_BARCODE_TYPE[c.symbology];
      const height = c.height ?? DEFAULT_BARCODE_HEIGHT;
      const readable = c.readable ? 1 : 0;
      const rotation = c.rotation ?? DEFAULT_ROTATION;
      const narrow = c.narrowBarWidth ?? DEFAULT_NARROW_BAR;
      const wide = c.wideBarWidth ?? DEFAULT_WIDE_BAR;
      const escaped = escapeTsplString(c.content);
      return `${TSC_COMMAND.BARCODE} ${x},${y},"${type}",${height},${readable},${rotation},${narrow},${wide},"${escaped}"`;
    }

    case 'qrcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const ecc = c.errorCorrection ?? DEFAULT_QR_ECC;
      const cellWidth = c.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
      const rotation = c.rotation ?? DEFAULT_ROTATION;
      const escaped = escapeTsplString(c.content);
      return `${TSC_COMMAND.QRCODE} ${x},${y},${ecc},${cellWidth},${QR_MODE_AUTO},${rotation},"${escaped}"`;
    }
  }
}

/** Compiles a `ResolvedPrintDocument` into a TSC/TSPL2 command string. */
export function compileToTSC(document: ResolvedPrintDocument): string {
  const lines: string[] = [];
  const dpi = document.dpi;
  const wMM = Math.round((document.widthDots / dpi) * MM_PER_INCH);
  const hMM = document.heightDots > 0 ? Math.round((document.heightDots / dpi) * MM_PER_INCH) : 0;
  const gMM = Math.round((document.gapDots / dpi) * MM_PER_INCH);

  lines.push(`${TSC_COMMAND.SIZE} ${wMM} mm,${hMM} mm`);
  lines.push(`${TSC_COMMAND.GAP} ${gMM} mm,0 mm`);
  lines.push(`${TSC_COMMAND.SPEED} ${document.speed}`);
  lines.push(`${TSC_COMMAND.DENSITY} ${document.density}`);
  lines.push(`${TSC_COMMAND.DIRECTION} ${document.direction}`);
  lines.push(TSC_COMMAND.CLS);

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\r\n`-joined output.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${TSC_COMMAND.PRINT} ${document.copies}`);
  return lines.join('\r\n') + '\r\n';
}

/**
 * TSC has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to satisfy
 * `PrintCompiler`'s shared call shape and isn't otherwise used.
 */
export class TscCompiler implements PrintCompiler<string> {
  /**
   * Known limitation — mixed string encoding when an `image` element is
   * present: the returned string interleaves two incompatible byte
   * conventions. Text content (from `text`/`block`/`barcode`/`qrcode`
   * elements) is ordinary UTF-8-intended text, but an `image` element's
   * `BITMAP` payload is built by {@link encodeTscBitmapPayload} as
   * "one JS char code = one raw byte" (latin-1 style), since that payload is
   * already-binary pixel data, not text.
   *
   * A caller turning this string into wire bytes must NOT run the whole
   * string through a naive UTF-8 encoder (e.g. `TextEncoder`) when the
   * document contains an image element — that would re-encode every bitmap
   * byte ≥ 0x80 as a multi-byte UTF-8 sequence and corrupt the bitmap.
   * Correctly transmitting a document that mixes non-ASCII text (e.g.
   * Vietnamese product names) with an image element requires per-segment
   * encoding (latin-1 for the bitmap span, UTF-8 elsewhere) that this
   * package does not yet provide — out of scope here; this is documentation
   * of an existing constraint, not a fix.
   */
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToTSC(document);
  }
}
