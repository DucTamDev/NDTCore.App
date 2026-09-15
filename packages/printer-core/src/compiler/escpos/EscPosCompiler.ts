import type { ResolvedPrintDocument, PrintElement } from '../../document';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { TextOptions } from '../../builder/content/TextElement';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';
import { encodeEscPosText } from './EscPosCodePage';
import { encodeEscPosImage } from './EscPosImageEncoder';
import { encodeEscPosBarcode } from './EscPosBarcodeEncoder';
import { encodeEscPosQrCode } from './EscPosQrCodeEncoder';

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

function compileTextElement(content: string, options: Record<string, unknown>, profile: PrinterProfile | undefined): Uint8Array[] {
  const o = options as TextOptions;
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
    // reverse/erase stay no-ops, same as portakal. Rendering these to an
    // image raster instead is a Phase 2/3 candidate, out of scope here.
    case 'box':
    case 'line':
    case 'circle':
    case 'ellipse':
    case 'reverse':
    case 'erase':
      return [];
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
