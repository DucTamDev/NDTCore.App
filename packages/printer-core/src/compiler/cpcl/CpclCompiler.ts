import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { BarcodeSymbology } from '../../barcode';
import type { QrErrorCorrectionLevel } from '../../qrcode';
import type { TextOptions } from '../../builder/content/TextElement';
import { CPCL_COMMAND } from './CpclCommand';
import { encodeCpclBitmapPayload } from './CpclEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

const DEFAULT_FONT = '2';

/**
 * `TEXT`/`TEXTnn` command, per the CPCL Programmer's Manual's Text Field
 * command: `TEXT <font> <size> <x> <y>` followed by the string data on its
 * own line. `size` defaults to `0` (not `1`) here, matching portakal's own
 * `languages/cpcl.ts` default exactly — CPCL's built-in fonts treat `0` as
 * their own base size, not "no text".
 */
function compileTextElement(content: string, options: TextOptions | undefined): string {
  const o = options ?? {};
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const font = o.font ?? DEFAULT_FONT;
  const size = o.size ?? 0;
  const rotation = o.rotation ?? 0;
  const cmd = rotation === 0 ? CPCL_COMMAND.TEXT : `${CPCL_COMMAND.TEXT}${rotation}`;
  return `${cmd} ${font} ${size} ${x} ${y}\r\n${content}`;
}

/**
 * Per-row line height, in dots, used to stack a `table` element's formatted
 * lines. Table rows are compiled via `compileTextElement` with no font
 * override, so they render at `DEFAULT_FONT`'s ("2") glyph height on the
 * CPCL built-in font table (20w x 12h, per `CpclPreviewRenderer`'s
 * `CPCL_FONTS['2']`) — kept as one named constant, reusing that same figure,
 * same consistency reason `EplCompiler`'s `DEFAULT_TABLE_ROW_HEIGHT_DOTS`
 * documents.
 */
const DEFAULT_TABLE_ROW_HEIGHT_DOTS = 12;

/** CPCL `BARCODE` command's bar-code-type token per symbology, per the CPCL Programmer's Manual's Bar Code Field command table. Net new — portakal never compiles a barcode element for CPCL (`parsers/cpcl.ts`'s own comment notes `BARCODE` is recognized-but-discarded, no ground truth to derive from). `itf` has no dedicated CPCL type name — approximated from the closest documented variant (interleaved 2 of 5). Human-readable-text visibility is controlled by a separate stateful CPCL command rather than an inline `BARCODE` parameter, so `BarcodeConfig.readable` isn't applied here — a documented gap, not a silent drop. */
const CPCL_BARCODE_TYPE: Record<BarcodeSymbology, string> = {
  code39: '39',
  code93: '93',
  code128: '128',
  codabar: 'CODABAR',
  ean8: 'EAN8',
  ean13: 'EAN13',
  upca: 'UPCA',
  upce: 'UPCE',
  /** Closest documented variant (Interleaved 2 of 5) — CPCL's base bar-code-type table has no separate "standard" ITF entry. */
  itf: '2OF5',
};

const DEFAULT_BARCODE_HEIGHT = 50;
const DEFAULT_NARROW_BAR = 2;
const DEFAULT_BARCODE_RATIO = 2;

const DEFAULT_QR_MAGNIFICATION = 6;
const DEFAULT_QR_ECC: QrErrorCorrectionLevel = 'M';
/** `B QR`'s model field — model 2 is the current, broadly-supported QR model per the CPCL Programmer's Manual, same choice `ZplCompiler` makes for `^BQ`'s own model field. */
const QR_MODEL = 2;
/** CPCL QR data-line's encodation-mode letter for "automatic" input mode (vs. manual byte/numeric/alphanumeric selection). */
const QR_MODE_AUTO = 'A';

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image': {
      const o = element.options ?? {};
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const hex = encodeCpclBitmapPayload(bmp);
      return `${CPCL_COMMAND.IMAGE} ${bmp.bytesPerRow} ${bmp.height} ${x} ${y} ${hex}`;
    }

    case 'box': {
      const o = element.options;
      const t = o.thickness ?? 1;
      const x2 = o.x + o.width;
      const y2 = o.y + o.height;
      return `${CPCL_COMMAND.BOX} ${o.x} ${o.y} ${x2} ${y2} ${t}`;
    }

    // CPCL's native LINE command draws a straight line between any two
    // points, axis-aligned or not — unlike EPL2's `LO`/ZPL's `^GB`, it needs
    // no axis-aligned-vs-diagonal split, so `'line'` and `'diagonal'` share
    // this one case, ported straight from portakal's own `languages/cpcl.ts`.
    case 'line':
    case 'diagonal': {
      const o = element.options;
      const t = o.thickness ?? 1;
      return `${CPCL_COMMAND.LINE} ${o.x1} ${o.y1} ${o.x2} ${o.y2} ${t}`;
    }

    // CPCL has no built-in command for rendering a circle, an ellipse
    // outline, a standalone reverse-print region, or a standalone erase
    // region — matching portakal's own `compileToCPCL()`, which returns `''`
    // for all four rather than inventing new command grammar for them.
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return '';

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

    // No documented native CPCL cutter command (same gap EPL2's `EplCompiler`
    // has) — documented no-op.
    case 'cut':
      return '';

    // Real behavior: format the rows into text lines via the shared
    // `formatTable()` (same helper `EplCompiler`'s/`ZplCompiler`'s `'table'`
    // case uses), then emit each line as its own `TEXT` command, stacked one
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

    // Neither CPCL nor this package has a native "page break" / "advance the
    // cursor by N dots" / "lay out children in a row-or-column" primitive —
    // documented no-op, same precedent as `EplCompiler`'s/`ZplCompiler`'s
    // equivalent cases, pending a real auto-layout design (not a bug).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return '';

    // Not in portakal (`parsers/cpcl.ts`'s own comment notes `BARCODE` is
    // recognized-but-discarded, no structured decode to use as ground truth)
    // — derived from the CPCL Programmer's Manual's `BARCODE` command grammar
    // as the minimal correct implementation, same approach used for
    // TSC's/ZPL's/EPL2's equivalent gaps. See `CPCL_BARCODE_TYPE`'s doc
    // comment for the bar-code-type table's confidence caveats.
    case 'barcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const type = CPCL_BARCODE_TYPE[c.symbology];
      const width = c.narrowBarWidth ?? DEFAULT_NARROW_BAR;
      const ratio = c.narrowBarWidth && c.wideBarWidth ? Math.round(c.wideBarWidth / c.narrowBarWidth) : DEFAULT_BARCODE_RATIO;
      const height = c.height ?? DEFAULT_BARCODE_HEIGHT;
      return `${CPCL_COMMAND.BARCODE} ${type} ${width} ${ratio} ${height} ${x} ${y} ${c.content}`;
    }

    // Not in portakal, same gap as `barcode` above. CPCL's 2D QR block
    // (`B QR<x>,<y>` / `M<model>` / `U<magnification>` / `<ecc><mode>,<data>`
    // / `ENDQR`) is corroborated only against the CPCL Programmer's Manual's
    // QR Code section, not against any ground truth in this repo or in
    // portakal — this is a lower-confidence, minimal-parameter judgment call
    // (position, model, magnification, error correction, content) rather
    // than a fully verified port; flagged in the task report for follow-up
    // verification against hardware. Rotation isn't applied — the QR block
    // has no inline rotation field, same class of documented gap
    // `ZplCompiler`'s `^BQ` case has for its own orientation parameter.
    case 'qrcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const magnification = c.cellWidth ?? DEFAULT_QR_MAGNIFICATION;
      const ecc = c.errorCorrection ?? DEFAULT_QR_ECC;
      return `${CPCL_COMMAND.QRCODE_START}${x},${y}\r\nM${QR_MODEL}\r\nU${magnification}\r\n${ecc}${QR_MODE_AUTO},${c.content}\r\n${CPCL_COMMAND.QRCODE_END}`;
    }
  }
}

const DEFAULT_HEIGHT_DOTS = 400; // matches portakal's own CPCL compiler fallback
const MAX_DENSITY = 15;
/** `TONE`'s own scale (0-200), per the CPCL Programmer's Manual's darkness command — portakal's own `(density / 15) * 200` mapping from this package's shared 0-15 density scale. */
const TONE_SCALE = 200;

/** Compiles a `ResolvedPrintDocument` into a CPCL command string. */
export function compileToCPCL(document: ResolvedPrintDocument): string {
  const lines: string[] = [];

  const height = document.heightDots > 0 ? document.heightDots : DEFAULT_HEIGHT_DOTS;
  lines.push(`${CPCL_COMMAND.SESSION_START} 0 ${document.dpi} ${document.dpi} ${height} ${document.copies}`);
  lines.push(`${CPCL_COMMAND.TONE} ${Math.round((document.density / MAX_DENSITY) * TONE_SCALE)}`);
  lines.push(`${CPCL_COMMAND.SPEED} ${document.speed}`);
  lines.push(`${CPCL_COMMAND.PAGE_WIDTH} ${document.widthDots}`);

  for (const element of document.elements) {
    // A no-op element (or empty-content `raw`) compiles to `''` — skip it so
    // it doesn't push a spurious blank line into the `\r\n`-joined output.
    const line = compileElement(element);
    if (line) lines.push(line);
  }

  lines.push(CPCL_COMMAND.PRINT);
  return lines.join('\r\n') + '\r\n';
}

/**
 * CPCL has no code-page/byte-encoding step (unlike ESC/POS) — its compiled
 * output is a plain command string, so `profile` is accepted only to satisfy
 * `PrintCompiler`'s shared call shape and isn't otherwise used.
 */
export class CpclCompiler implements PrintCompiler<string> {
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToCPCL(document);
  }
}
