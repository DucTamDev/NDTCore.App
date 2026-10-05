import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { Printer } from '../models/printer/Printer';
import { CutterMode, PaperSize, PaperType } from '../models/paper/PaperOptions';
import { PrintKind } from '../models/printer/PrintKind';
import type { PrintOptions } from '../models/printing/PrintOptions';
import { makeEscPosLanguage, makePrinter, makeTsplLanguage } from './printerFixtures';

/** Một trường hợp encode cố định: cấu hình máy in, ảnh, và dấu vân tay byte phải ra đúng. */
export interface EncodeCase {
  name: string;

  printer: Printer;

  /** PNG base64. */
  image: string;

  options?: PrintOptions;

  /** `<số byte>:<FNV-1a 32-bit hex>` của toàn bộ byte gửi tới máy in. */
  fingerprint: string;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;

const FNV_PRIME = 0x01000193;

/** Dấu vân tay ngắn của một dãy byte để so sánh byte encode trước và sau refactor mà không lưu nguyên dữ liệu. */
export const fingerprintOf = (bytes: Uint8Array): string => {
  let hash = FNV_OFFSET_BASIS;

  // FNV-1a là phép XOR rồi nhân theo từng byte; `>>> 0` giữ kết quả trong 32 bit không dấu.
  for (const byte of bytes) {
    hash ^= byte; // eslint-disable-line no-bitwise
    hash = Math.imul(hash, FNV_PRIME) >>> 0; // eslint-disable-line no-bitwise
  }

  return `${bytes.length}:${hash.toString(16).padStart(8, '0')}`;
};

/** Ảnh 8x2 sọc đen trắng; `forbidPlte` tránh lỗi encoder `upng-js` với ảnh 2 màu cực nhỏ. */
export const stripedPngBase64 = (): string => {
  const width = 8;
  const height = 2;
  const rgba = new Uint8Array(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const value = pixel % 2 === 0 ? 0 : 255;
    rgba.set([value, value, value, 255], pixel * 4);
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], width, height, 0, [], true))).toString('base64');
};

const usbConnection = { type: ConnectionType.Usb, vendorId: 1, productId: 2 } as const;

const dieCutPaper = {
  type: PaperType.DieCut,
  paperSize: PaperSize.Mm58,
  itemWidthMm: 20,
  itemHeightMm: 10,
  columns: 2,
  horizontalGapMm: 2,
  verticalGapMm: 2,
} as const;

/** Các trường hợp phủ cả hai ngôn ngữ, giấy cuộn và giấy tem, có và không cắt. */
export const ENCODE_CASES: EncodeCase[] = [
  {
    name: 'ESC/POS, 80mm, cắt cuối job',
    printer: makePrinter({ connection: usbConnection, language: makeEscPosLanguage() }),
    image: stripedPngBase64(),
    fingerprint: '10380:a79412dd',
  },
  {
    name: 'ESC/POS, 58mm, không cắt',
    printer: makePrinter({
      connection: usbConnection,
      language: makeEscPosLanguage(),
      paper: { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.None },
    }),
    image: stripedPngBase64(),
    fingerprint: '4618:ad6f37a5',
  },
  {
    name: 'TSPL, hoá đơn giấy cuộn 80mm',
    printer: makePrinter({ connection: usbConnection, language: makeTsplLanguage() }),
    image: stripedPngBase64(),
    fingerprint: '10472:4d5f733a',
  },
  {
    name: 'TSPL, tem 2 cột, 2 hàng',
    printer: makePrinter({
      connection: usbConnection,
      kind: PrintKind.Label,
      language: makeTsplLanguage(),
      paper: { ...dieCutPaper },
    }),
    image: stripedPngBase64(),
    options: { rows: 2 },
    fingerprint: '1727:c3df6e5b',
  },
];
