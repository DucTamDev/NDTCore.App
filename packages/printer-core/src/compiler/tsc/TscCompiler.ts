import type { ResolvedPrintDocument, PrintElement } from '../../document';
import type { PrinterProfile } from '../../profile';
import type { PrintCompiler } from '../../core';
import type { BarcodeSymbology } from '../../barcode';
import type { QrErrorCorrectionLevel } from '../../qrcode';
import type { TextOptions } from '../../builder/content/TextElement';
import type { ImageOptions } from '../../builder/content/ImageElement';
import type { BoxOptions } from '../../builder/drawing/BoxElement';
import type { LineOptions } from '../../builder/drawing/LineElement';
import type { CircleOptions } from '../../builder/drawing/CircleElement';
import type { EllipseOptions } from '../../builder/drawing/EllipseElement';
import type { ReverseOptions } from '../../builder/drawing/ReverseElement';
import type { EraseOptions } from '../../builder/drawing/EraseElement';
import { TSC_COMMAND } from './TscCommand';
import { encodeTscBitmapPayload } from './TscEncoder';

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

function compileTextElement(content: string, options: Record<string, unknown>): string {
  const o = options as TextOptions;
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const font = o.font ?? DEFAULT_FONT;
  const rotation = o.rotation ?? DEFAULT_ROTATION;
  const xMul = o.xScale ?? o.size ?? 1;
  const yMul = o.yScale ?? o.size ?? 1;

  if (o.maxWidth) {
    const align = o.align === 'center' ? 2 : o.align === 'right' ? 3 : 1;
    const spacing = o.lineSpacing ?? 0;
    return `${TSC_COMMAND.BLOCK} ${x},${y},${o.maxWidth},${o.maxWidth},"${font}",${rotation},${xMul},${yMul},${spacing},${align},"${content}"`;
  }

  return `${TSC_COMMAND.TEXT} ${x},${y},"${font}",${rotation},${xMul},${yMul},"${content}"`;
}

function compileElement(element: PrintElement): string {
  switch (element.type) {
    case 'text':
      return compileTextElement(element.content, element.options);

    case 'image': {
      const o = element.options as ImageOptions;
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const bmp = element.bitmap;
      const payload = encodeTscBitmapPayload(bmp);
      return `${TSC_COMMAND.BITMAP} ${x},${y},${bmp.bytesPerRow},${bmp.height},0,${payload}`;
    }

    case 'box': {
      const o = element.options as unknown as BoxOptions;
      const x2 = o.x + o.width;
      const y2 = o.y + o.height;
      const t = o.thickness ?? 1;
      if (o.radius) {
        return `${TSC_COMMAND.BOX} ${o.x},${o.y},${x2},${y2},${t},${o.radius}`;
      }
      return `${TSC_COMMAND.BOX} ${o.x},${o.y},${x2},${y2},${t}`;
    }

    case 'line': {
      const o = element.options as unknown as LineOptions;
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

    case 'circle': {
      const o = element.options as unknown as CircleOptions;
      const t = o.thickness ?? 1;
      return `${TSC_COMMAND.CIRCLE} ${o.x},${o.y},${o.diameter},${t}`;
    }

    case 'ellipse': {
      const o = element.options as unknown as EllipseOptions;
      const t = o.thickness ?? 1;
      return `${TSC_COMMAND.ELLIPSE} ${o.x},${o.y},${o.width},${o.height},${t}`;
    }

    case 'reverse': {
      const o = element.options as unknown as ReverseOptions;
      return `${TSC_COMMAND.REVERSE} ${o.x},${o.y},${o.width},${o.height}`;
    }

    case 'erase': {
      const o = element.options as unknown as EraseOptions;
      return `${TSC_COMMAND.ERASE} ${o.x},${o.y},${o.width},${o.height}`;
    }

    case 'raw':
      return typeof element.content === 'string' ? element.content : '';

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
      const escaped = c.content.replace(/"/g, '\\"');
      return `${TSC_COMMAND.BARCODE} ${x},${y},"${type}",${height},${readable},${rotation},${narrow},${wide},"${escaped}"`;
    }

    case 'qrcode': {
      const c = element.options;
      const x = c.x ?? 0;
      const y = c.y ?? 0;
      const ecc = c.errorCorrection ?? DEFAULT_QR_ECC;
      const cellWidth = c.cellWidth ?? DEFAULT_QR_CELL_WIDTH;
      const rotation = c.rotation ?? DEFAULT_ROTATION;
      const escaped = c.content.replace(/"/g, '\\"');
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
    lines.push(compileElement(element));
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
  compile(document: ResolvedPrintDocument, _profile?: PrinterProfile): string {
    return compileToTSC(document);
  }
}
