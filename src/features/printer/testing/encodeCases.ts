import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { RenderMode } from '../models/printer/PrinterDriver';
import type { Printer } from '../models/printer/Printer';
import { CutterMode, PaperSize, PrintPaperType } from '../models/paper/PrintPaperConfig';
import { PrintType } from '../models/printing/PrintType';
import type { PrintDocument } from '../models/printing/PrintDocument';
import type { PrintDocuments, PrintOptions } from '../drivers/IPrinterDriver';
import { makeEscPosDriver, makePrinter, makeTsplDriver } from './printerFixtures';

/** Một trường hợp encode cố định: cấu hình máy in, nội dung, và dấu vân tay byte phải ra đúng. */
export interface EncodeCase {
  name: string;

  printer: Printer;

  documents: PrintDocuments;

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
const stripedPngBase64 = (): string => {
  const width = 8;
  const height = 2;
  const rgba = new Uint8Array(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const value = pixel % 2 === 0 ? 0 : 255;
    rgba.set([value, value, value, 255], pixel * 4);
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], width, height, 0, [], true))).toString('base64');
};

const receiptDocument: PrintDocument = {
  elements: [
    { type: 'text', content: 'NDT Coffee', x: 0, y: 0 },
    { type: 'line', x: 0, y: 20 },
    { type: 'row', left: 'Mã đơn', right: '#001', x: 0, y: 40 },
    { type: 'row', left: 'Cà phê sữa x2', right: '58.000', x: 0, y: 60 },
    { type: 'text', content: 'Cảm ơn quý khách', x: 0, y: 80 },
  ],
};

const labelDocument: PrintDocument = {
  elements: [
    { type: 'text', content: '#001', x: 0, y: 0 },
    { type: 'text', content: 'Trà đào', x: 0, y: 20 },
  ],
};

const usbConnection = { type: PrinterConnectionType.Usb, vendorId: 1, productId: 2 } as const;

const dieCutPaper = {
  type: PrintPaperType.DieCut,
  paperSize: PaperSize.Mm58,
  itemWidthMm: 20,
  itemHeightMm: 10,
  columns: 2,
  horizontalGapMm: 2,
  verticalGapMm: 2,
} as const;

/** Các trường hợp phủ cả hai ngôn ngữ, hai cách render, giấy cuộn và giấy tem, có và không cắt. */
export const ENCODE_CASES: EncodeCase[] = [
  {
    name: 'ESC/POS lệnh văn bản, 80mm, cắt cuối job',
    printer: makePrinter({
      connection: usbConnection,
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm80 },
    }),
    documents: { text: receiptDocument },
    fingerprint: '234:f64def3b',
  },
  {
    name: 'ESC/POS lệnh văn bản, 58mm, không cắt',
    printer: makePrinter({
      connection: usbConnection,
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.None },
    }),
    documents: { text: receiptDocument },
    fingerprint: '184:89696237',
  },
  {
    name: 'ESC/POS ảnh, 80mm, cắt cuối job',
    printer: makePrinter({
      connection: usbConnection,
      driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }),
    }),
    documents: { text: receiptDocument, image: stripedPngBase64() },
    fingerprint: '10380:a79412dd',
  },
  {
    name: 'ESC/POS ảnh, 58mm, không cắt',
    printer: makePrinter({
      connection: usbConnection,
      driver: makeEscPosDriver({ config: { renderMode: RenderMode.Bitmap } }),
      paper: { type: PrintPaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.None },
    }),
    documents: { text: receiptDocument, image: stripedPngBase64() },
    fingerprint: '4618:ad6f37a5',
  },
  {
    name: 'TSPL lệnh văn bản, hoá đơn giấy cuộn 80mm',
    printer: makePrinter({
      connection: usbConnection,
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }),
    }),
    documents: { text: receiptDocument },
    fingerprint: '383:4af9d05e',
  },
  {
    name: 'TSPL ảnh, hoá đơn giấy cuộn 80mm',
    printer: makePrinter({ connection: usbConnection, driver: makeTsplDriver() }),
    documents: { text: receiptDocument, image: stripedPngBase64() },
    fingerprint: '10472:4d5f733a',
  },
  {
    name: 'TSPL lệnh văn bản, tem 2 cột',
    printer: makePrinter({
      connection: usbConnection,
      type: PrintType.Label,
      driver: makeTsplDriver({ config: { renderMode: RenderMode.Encoder } }),
      paper: { ...dieCutPaper },
    }),
    documents: { text: labelDocument },
    fingerprint: '209:ca61e468',
  },
  {
    name: 'TSPL ảnh, tem 2 cột, 2 hàng',
    printer: makePrinter({
      connection: usbConnection,
      type: PrintType.Label,
      driver: makeTsplDriver(),
      paper: { ...dieCutPaper },
    }),
    documents: { text: labelDocument, image: stripedPngBase64() },
    options: { rows: 2 },
    fingerprint: '1727:c3df6e5b',
  },
];
