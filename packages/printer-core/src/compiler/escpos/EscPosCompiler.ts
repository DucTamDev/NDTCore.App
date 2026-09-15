import type { ResolvedPrintDocument } from '../../document';
import type { PrintElement } from '../../builder';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { TextOptions } from '../../builder/content/TextElement';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';
import { encodeEscPosText } from './EscPosCodePage';
import { encodeEscPosImage } from './EscPosImageEncoder';
import { encodeEscPosBarcode } from './EscPosBarcodeEncoder';
import { encodeEscPosQrCode } from './EscPosQrCodeEncoder';
import { formatTable, validateTableColumns } from '../../receipt';

function alignByte(align: TextOptions['align']): number {
  switch (align) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

function compileTextElement(content: string, options: TextOptions | undefined, profile: PrinterProfile | undefined): Uint8Array[] {
  const o = options ?? {};
  const chunks: Uint8Array[] = [];

  chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.ALIGN, alignByte(o.align)]));

  if (o.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, 1]));
  if (o.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, 1]));

  if (o.size !== undefined && o.size > 1) {
    const mag = o.size - 1;
    // eslint-disable-next-line no-bitwise -- packing width/height magnification into GS ! n's nibbles, per spec
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, ((mag & 0x07) << 4) | (mag & 0x07)]));
  }

  if (o.reverse) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.REVERSE, 1]));

  chunks.push(encodeEscPosText(content, profile));
  chunks.push(new Uint8Array([ESC_POS.LF]));

  if (o.bold) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.BOLD, 0]));
  if (o.underline) chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.UNDERLINE, 0]));
  if (o.size !== undefined && o.size > 1) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.SIZE, 0]));
  if (o.reverse) chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.REVERSE, 0]));
  chunks.push(new Uint8Array([ESC_POS.ESC, ESC_POS.ALIGN, 0]));

  return chunks;
}

function compileElement(element: PrintElement, profile: PrinterProfile | undefined): Uint8Array[] {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options, profile);

    case 'image':
      return [encodeEscPosImage(element.bitmap)];

    case 'barcode':
      return [encodeEscPosBarcode(element.options)];

    case 'qrcode':
      return [encodeEscPosQrCode(element.options)];

    case 'raw':
      return [typeof element.content === 'string' ? encodeEscPosText(element.content, profile) : element.content];

    // ESC/POS has no native vector-drawing command — box/line/circle/ellipse/
    // reverse/erase/diagonal stay no-ops, same as portakal. Rendering these to
    // an image raster instead is a Phase 2/3 candidate, out of scope here.
    case 'box':
    case 'line':
    case 'diagonal':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return [];

    // No native "page break" / "advance N dots" / "row-or-column auto-layout"
    // primitive, and this package has no auto-layout engine yet — placeholder
    // pending a real design, not a bug (see design spec's PageBreak/Spacer/
    // Row/Column compiler-behavior bullet).
    case 'pageBreak':
    case 'spacer':
    case 'row':
    case 'column':
      return [];

    case 'cut': {
      const mode = element.options?.mode ?? 'full';
      if (mode === 'off') return [];

      const rows = element.options?.rows;
      if (rows !== undefined) {
        // GS V m n (function B): feed n lines then cut — m selects full (65) vs partial (66).
        const m = mode === 'partial' ? 0x42 : 0x41;
        return [new Uint8Array([ESC_POS.GS, ESC_POS.CUT, m, rows])];
      }

      // GS V m (function A): cut at the current position, no explicit feed — m selects full (0) vs partial (1).
      const m = mode === 'partial' ? 1 : 0;
      return [new Uint8Array([ESC_POS.GS, ESC_POS.CUT, m])];
    }

    case 'table': {
      validateTableColumns(element.options.columns);
      const totalWidth = element.options.columns.reduce((sum, column) => sum + column.width, 0);
      const lines = formatTable(element.options.columns, element.options.rows, totalWidth);
      const chunks: Uint8Array[] = [];
      for (const line of lines) chunks.push(...compileTextElement(line, undefined, profile));
      return chunks;
    }
  }
}

/** Compiles a `ResolvedPrintDocument` into ESC/POS bytes. */
export class EscPosCompiler implements PrintCompiler<Uint8Array> {
  compile(document: ResolvedPrintDocument, profile?: PrinterProfile): Uint8Array {
    const chunks: Uint8Array[] = [new Uint8Array([ESC_POS.ESC, ESC_POS.INIT])];

    for (const element of document.elements) {
      chunks.push(...compileElement(element, profile));
    }

    return concatEscPosBytes(chunks);
  }
}
