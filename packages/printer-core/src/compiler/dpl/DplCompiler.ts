import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { BarcodeSymbology } from '../../barcode';
import type { QrErrorCorrectionLevel } from '../../qrcode';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../builder/content/TextElement';
import { DPL_COMMAND } from './DplCommand';
import { encodeDplBitmapPayload } from './DplEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

/** Fixed-field record rotation code (`1`-`4`, the text/box/line record's own leading digit) for a given `Rotation`, per Honeywell/Datamax's DPL command reference. */
function dplRotation(rotation: Rotation | undefined): 1 | 2 | 3 | 4 {
  switch (rotation) {
    case 90:
      return 2;
    case 180:
      return 3;
    case 270:
      return 4;
    default:
      return 1;
  }
}

const DEFAULT_FONT = '9';

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const rot = dplRotation(o.rotation);
  const font = o.font ?? DEFAULT_FONT;
  const h = String(o.size ?? 1).padStart(4, '0');
  const w = h;
  const col = String(x).padStart(4, '0');
  const row = String(y).padStart(4, '0');
  return `${rot}${col}${row}${h}${w}000${font}${content}`;
}

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines. DPL's text record has no font-metrics table to derive a real glyph
 * height from (its `h`/`w` fields are a raw size multiplier, not a computed
 * pixel height, unlike EPL2's/TSC's built-in font tables) — kept as one
 * named constant, same fallback-default role `EplCompiler`'s
 * `DEFAULT_TABLE_ROW_HEIGHT_DOTS` serves for EPL2.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

/**
 * DPL `B` Bar Code Field type-selection digit per symbology. Net new —
 * portakal never compiles a barcode element for DPL (`parsers/dpl.ts` has no
 * structured decode of any bar-code-shaped record to use as ground truth),
 * so this table is a minimal, low-confidence judgment call rather than a
 * verified port, following the same allowance `EplCompiler`'s
 * `EPL_BARCODE_TYPE` doc comment documents for its own gap. Recommend
 * verifying against Honeywell/Datamax's own command reference or real
 * hardware before relying on it in production.
 */
const DPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '0',
  code93: '1',
  code128: '3',
  codabar: '2',
  ean8: '4',
  ean13: '5',
  upca: '6',
  itf: '7',
  /** No dedicated UPC-E entry found — approximated with UPC-A's own code. */
  upce: '6',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_WIDE_BAR = 2;
const DEFAULT_QR_CELL_WIDTH = 4;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const col = String(x).padStart(4, '0');
      const row = String(y).padStart(4, '0');
      const w = String(bmp.bytesPerRow).padStart(4, '0');
      const h = String(bmp.height).padStart(4, '0');
      const payload = encodeDplBitmapPayload(bmp);
      return `1${col}${row}${h}${w}0005${payload}`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const col = String(o.x).padStart(4, '0');
      const row = String(o.y).padStart(4, '0');
      const w = String(o.width).padStart(4, '0');
      const h = String(o.height).padStart(4, '0');
      const th = String(t).padStart(4, '0');
      return `1${col}${row}${h}${w}${th}${DPL_COMMAND.LINE_BOX_MARKER}`;
    }

    // Axis-aligned only, ported as-is from portakal's own `languages/dpl.ts`
    // (which returns `""` for a non-axis-aligned pair rather than
    // approximating one, unlike EPL2's own line-fallback). `PrintBuilder.line()`
    // always dispatches via `isDiagonal()` so it never produces a `'line'`
    // element with diagonal coordinates in practice.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) {
        const col = String(Math.min(o.x1, o.x2)).padStart(4, '0');
        const row = String(o.y1).padStart(4, '0');
        const w = String(Math.abs(o.x2 - o.x1)).padStart(4, '0');
        const th = String(t).padStart(4, '0');
        return `1${col}${row}${th}${w}0002${DPL_COMMAND.LINE_BOX_MARKER}`;
      }
      if (o.x1 === o.x2) {
        const col = String(o.x1).padStart(4, '0');
        const row = String(Math.min(o.y1, o.y2)).padStart(4, '0');
        const h = String(Math.abs(o.y2 - o.y1)).padStart(4, '0');
        const th = String(t).padStart(4, '0');
        return `1${col}${row}${h}${th}0002${DPL_COMMAND.LINE_BOX_MARKER}`;
      }
      return '';
    }

    // DPL's Line/Box Draw command has no diagonal capability (only the
    // axis-aligned col/row/height/width record `'line'`/`'box'` compile
    // above) — documented no-op, same precedent `EplCompiler`'s `'diagonal'`
    // case documents for EPL2's equally axis-only `LO` command.
    case 'diagonal':
      return '';

    // No native DPL command for a circle, ellipse outline, standalone
    // reverse-print region, or standalone erase region — documented no-op,
    // matching portakal's own `compileElement()` (which returns `""` for all
    // four) rather than inventing new record grammar for them.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // No documented native DPL cutter command — portakal's own
    // `languages/dpl.ts` has zero cut-related logic to port. Documented
    // no-op, same precedent as `EplCompiler`'s `'cut'` case.
    case 'cut':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper every language compiler's own `'table'`
    // case uses), then emit each line as its own fixed-field text record,
    // stacked one `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the
    // table's own y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const rowLines = formatTable(o.columns, o.rows, totalWidth);
      return rowLines.map((line, i) => compileTextElement(line, { x, y: y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS })).join('\r\n');
    }

    // Neither DPL nor this package has a native "page break" / "advance the
    // cursor by N dots" / "lay out children in a row-or-column" primitive —
    // documented no-op, same precedent as `EplCompiler`'s/`ZplCompiler`'s
    // equivalent cases, pending a real auto-layout design (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal — see `DPL_BARCODE_TYPE`'s doc comment for this
    // table's confidence caveats. Field order (rotation, position, bar
    // widths, height, type, human-readable flag, data) mirrors the shape
    // already established by this file's own text/box records.
    case 'barcode': {
      const c = element.options;
      const rot = dplRotation(c.rotation);
      const col = String(c.x ?? 0).padStart(4, '0');
      const row = String(c.y ?? 0).padStart(4, '0');
      const narrow = String(c.narrowBarWidth ?? DEFAULT_NARROW_BAR).padStart(4, '0');
      const wide = String(c.wideBarWidth ?? DEFAULT_WIDE_BAR).padStart(4, '0');
      const height = String(c.height ?? DEFAULT_BARCODE_HEIGHT).padStart(4, '0');
      const type = DPL_BARCODE_TYPE[c.symbology];
      const human = c.readable === false ? 'N' : 'Y';
      return `${rot}${col}${row}${narrow}${wide}${height}${DPL_COMMAND.BARCODE_MARKER}${type}${human}${c.content}`;
    }

    // Not in portakal, same gap as `barcode` above — DPL's 2D bar code
    // record grammar isn't corroborated anywhere accessible to this task, so
    // this is a minimal, low-confidence judgment call (position, rotation,
    // cell width, error correction, content), not a verified port. Flagged
    // in the task report for follow-up verification against real hardware
    // or Honeywell/Datamax's own documentation.
    case 'qrcode': {
      const c = element.options;
      const rot = dplRotation(c.rotation);
      const col = String(c.x ?? 0).padStart(4, '0');
      const row = String(c.y ?? 0).padStart(4, '0');
      const cell = String(c.cellWidth ?? DEFAULT_QR_CELL_WIDTH).padStart(4, '0');
      const ecc = c.errorCorrection ?? DEFAULT_QR_ECC;
      return `${rot}${col}${row}${cell}${DPL_COMMAND.BARCODE_MARKER}2D${ecc}${c.content}`;
    }
  }
}

/** Compiles a `ResolvedPrintDocument` into a Honeywell/Datamax DPL command string. */
export function compileToDPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(DPL_COMMAND.ENTER_LABEL_FORMAT);
  lines.push(`${DPL_COMMAND.DENSITY}${String(document.density).padStart(2, '0')}`);
  lines.push(`${DPL_COMMAND.SPEED}${String(document.speed).padStart(2, '0')}`);
  lines.push(`${DPL_COMMAND.WIDTH}${String(document.widthDots).padStart(4, '0')}`);

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\r\n`-joined output.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${DPL_COMMAND.QUANTITY}${String(document.copies).padStart(4, '0')}`);
  lines.push(DPL_COMMAND.END);
  return lines.join('\r\n') + '\r\n';
}

/**
 * DPL has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to satisfy
 * `PrintCompiler`'s shared call shape and isn't otherwise used.
 *
 * Known limitation — same mixed string encoding constraint as
 * `EplCompiler.compile()`'s doc comment describes: when an `image` element
 * is present, the returned string interleaves ordinary text (UTF-8-intended)
 * with the image record's raw-binary payload (one JS char code = one raw
 * byte, from `encodeDplBitmapPayload`). A caller turning this string into
 * wire bytes must not run it through a naive UTF-8 encoder when the document
 * contains an image element.
 */
export class DplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToDPL(document);
  }
}
