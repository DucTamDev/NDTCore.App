import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { BarcodeSymbology } from '../../barcode';
import type { QrErrorCorrectionLevel } from '../../qrcode';
import type { Rotation } from '../../types';
import type { TextOptions } from '../../builder/content/TextElement';
import { EPL_COMMAND } from './EplCommand';
import { encodeEplBitmapPayload } from './EplEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

/** EPL2 rotation code (`0`/`1`/`2`/`3`, the `A`/`B`/`b` commands' own rotation field) for a given `Rotation`, per the EPL2 Programmer's Guide. */
function eplRotation(rotation: Rotation | undefined): 0 | 1 | 2 | 3 {
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

const DEFAULT_FONT = '2';

function compileTextElement(content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const rot = eplRotation(o.rotation);
  const font = o.font ?? DEFAULT_FONT;
  const hMul = o.xScale ?? o.size ?? 1;
  const vMul = o.yScale ?? o.size ?? 1;
  const reverse = o.reverse ? 'R' : 'N';
  return `${EPL_COMMAND.TEXT}${x},${y},${rot},${font},${hMul},${vMul},${reverse},"${content}"`;
}

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines. Table rows are compiled via `compileTextElement` with no font
 * override, so they render at `DEFAULT_FONT`'s ("2") glyph height on the
 * EPL2 built-in font table (10w x 16h, per `EplPreviewRenderer`'s
 * `EPL_FONTS['2']`) — kept as one named constant, reusing that same figure,
 * same consistency reason `TscCompiler`'s `DEFAULT_TABLE_ROW_HEIGHT_DOTS`
 * documents.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 16;

/** EPL2 `B` command's barcode-selection character per symbology, per the EPL2 Programmer's Guide's Bar Code Field command table. Net new — portakal never compiles a barcode element for EPL (`parsers/epl.ts`'s own `B`/`b` cases are read-and-discard, no ground truth to derive from). `itf`/`upce` have no clean 1:1 entry in the documented table — approximated from the closest documented variant (see inline notes), lower confidence than the rest of this table. */
const EPL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '1',
  code93: '2',
  code128: '3',
  codabar: '6',
  ean8: '7',
  ean13: '8',
  upca: '9',
  /** Closest documented variant (UPC-Interleaved 2 of 5) — EPL2's base table has no separate "standard" ITF entry. */
  itf: 'B',
  /** No dedicated UPC-E entry in the documented table — approximated with UPC-A's own code. */
  upce: '9',
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
      const payload = encodeEplBitmapPayload(bmp);
      return `${EPL_COMMAND.IMAGE}${x},${y},${bmp.bytesPerRow},${bmp.height},${payload}`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const x2 = o.x + o.width;
      const y2 = o.y + o.height;
      return `${EPL_COMMAND.BOX}${o.x},${o.y},${x2},${y2},${t}`;
    }

    // Axis-aligned only — a genuinely diagonal line is the separate
    // `'diagonal'` case below. `PrintBuilder.line()` always dispatches via
    // `isDiagonal()` so it never produces a `'line'` element with diagonal
    // coordinates, but a hand-built `PrintElement` literal could bypass that
    // guarantee — the fallback below is ported as-is from portakal's own
    // `languages/epl.ts` (which never splits line/diagonal): it draws an
    // `LO` bar using only the x-span, silently ignoring the y-delta — an
    // approximation, not a real diagonal, since EPL2's `LO` command has no
    // diagonal capability.
    case 'line': {
      const o = element.options;
      const t = o.thickness ?? 1;
      if (o.y1 === o.y2) {
        const w = Math.abs(o.x2 - o.x1);
        return `${EPL_COMMAND.LINE}${Math.min(o.x1, o.x2)},${o.y1},${w},${t}`;
      }
      if (o.x1 === o.x2) {
        const h = Math.abs(o.y2 - o.y1);
        return `${EPL_COMMAND.LINE}${o.x1},${Math.min(o.y1, o.y2)},${t},${h}`;
      }
      return `${EPL_COMMAND.LINE}${o.x1},${o.y1},${Math.abs(o.x2 - o.x1)},${t}`;
    }

    // EPL2 has no native diagonal-line command (`LO` only draws axis-aligned
    // bars) — documented no-op, same precedent as `ZplCompiler`'s/
    // `TscCompiler`'s cases for a capability the language genuinely lacks.
    // The `'line'` case's non-axis-aligned fallback above is ported as-is
    // from portakal's own broken approximation, not reused here, since it
    // isn't a real diagonal renderer either.
    case 'diagonal':
      return '';

    // No native EPL2 command for a circle, ellipse outline, standalone
    // reverse-print region, or standalone erase region — documented no-op,
    // matching portakal's own `compileToEPL()` (which returns `''` for all
    // four) rather than inventing new command grammar for them.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // No documented native EPL2 cutter command (unlike ZPL's `^MM` or
    // TSPL's `SET CUTTER`) — portakal's own `languages/epl.ts` has zero
    // cut-related logic to port, and the base EPL2 command set
    // (`parsers/epl.ts`'s own recognized command-char list) has no
    // dedicated cutter command either. Documented no-op.
    case 'cut':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `ZplCompiler`'s/`TscCompiler`'s `'table'`
    // case uses), then emit each line as its own `A` text command, stacked
    // one `DEFAULT_TABLE_ROW_HEIGHT_DOTS` apart starting at the table's own
    // y.
    case 'table': {
      const o = element.options;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      validateTableColumns(o.columns);
      const totalWidth = o.columns.reduce((sum, column) => sum + column.width, 0);
      const rowLines = formatTable(o.columns, o.rows, totalWidth);
      return rowLines.map((line, i) => compileTextElement(line, { x, y: y + i * DEFAULT_TABLE_ROW_HEIGHT_DOTS })).join('\n');
    }

    // Neither EPL2 nor this package has a native "page break" / "advance the
    // cursor by N dots" / "lay out children in a row-or-column" primitive —
    // documented no-op, same precedent as `ZplCompiler`'s/`TscCompiler`'s
    // equivalent cases, pending a real auto-layout design (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal (`parsers/epl.ts`'s own `B`/`b` cases are
    // read-and-discard, no structured decode to use as ground truth) —
    // derived from the EPL2 Programmer's Guide's `B` Bar Code Field command
    // grammar as the minimal correct implementation, same approach used for
    // TSC's/ZPL's equivalent gaps. See `EPL_BARCODE_TYPE`'s doc comment for
    // the barcode-selection table's confidence caveats.
    case 'barcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const rot = eplRotation(c.rotation);
      const type = EPL_BARCODE_TYPE[c.symbology];
      const narrow = c.narrowBarWidth ?? DEFAULT_NARROW_BAR;
      const wide = c.wideBarWidth ?? DEFAULT_WIDE_BAR;
      const height = c.height ?? DEFAULT_BARCODE_HEIGHT;
      const human = c.readable === false ? 'N' : 'B';
      return `${EPL_COMMAND.BARCODE}${x},${y},${rot},${type},${narrow},${wide},${height},${human},"${c.content}"`;
    }

    // Not in portakal, same gap as `barcode` above. Unlike `B`'s 1D grammar
    // (well documented), EPL2's `b` 2D command's full parameter grammar
    // isn't corroborated anywhere in this repo or in portakal — this is a
    // lower-confidence, minimal-parameter judgment call (position, rotation,
    // module width, error correction, content) rather than a fully verified
    // port; flagged in the task report for follow-up verification against
    // hardware or the EPL2 Programmer's Guide.
    case 'qrcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const rot = eplRotation(c.rotation);
      const cellWidth = c.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
      const ecc = c.errorCorrection ?? DEFAULT_QR_ECC;
      return `${EPL_COMMAND.TWO_D_BARCODE}${x},${y},${rot},"QR",${cellWidth},${ecc},"${c.content}"`;
    }
  }
}

/** Compiles a `ResolvedPrintDocument` into an EPL2 command string. */
export function compileToEPL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  lines.push(EPL_COMMAND.CLEAR_IMAGE_BUFFER);
  lines.push(`${EPL_COMMAND.LABEL_WIDTH}${document.widthDots}`);
  if (document.heightDots > 0) {
    lines.push(`${EPL_COMMAND.LABEL_HEIGHT_GAP}${document.heightDots},${document.gapDots}`);
  }
  lines.push(`${EPL_COMMAND.SPEED}${document.speed}`);
  lines.push(`${EPL_COMMAND.DENSITY}${document.density}`);

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\n`-joined output.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(`${EPL_COMMAND.PRINT}${document.copies}`);
  return lines.join('\n') + '\n';
}

/**
 * EPL2 has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to satisfy
 * `PrintCompiler`'s shared call shape and isn't otherwise used.
 *
 * Known limitation — same mixed string encoding constraint as
 * `TscCompiler.compile()`'s doc comment describes: when an `image` element
 * is present, the returned string interleaves ordinary text (UTF-8-intended)
 * with `GW`'s raw-binary payload (one JS char code = one raw byte, from
 * `encodeEplBitmapPayload`). A caller turning this string into wire bytes
 * must not run it through a naive UTF-8 encoder when the document contains
 * an image element.
 */
export class EplCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToEPL(document);
  }
}
