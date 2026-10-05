import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { TsplLanguage } from '../TsplLanguage';
import { fingerprintOf, stripedPngBase64 } from '../../../testing/encodeCases';
import { PrintKind } from '../../../models/printer/PrintKind';
import { CutterMode } from '../../../models/paper/CutterMode';
import { PaperSize } from '../../../models/paper/PaperSize';
import { PaperType } from '../../../models/paper/PaperType';
import { makePrinter, makeTsplLanguage } from '../../../testing/printerFixtures';
import { PrintErrorCode } from '../../../errors';
import type { Printer } from '../../../models/printer/Printer';
import type { PaperOptions } from '../../../models/paper/PaperOptions';
import { decodePngBase64ToMonochrome } from '../../../rendering/MonochromeBitmap';

jest.mock('../../../rendering/MonochromeBitmap', () => {
  const actual = jest.requireActual('../../../rendering/MonochromeBitmap');
  return { __esModule: true, ...actual, decodePngBase64ToMonochrome: jest.fn(actual.decodePngBase64ToMonochrome) };
});

const printer = makePrinter({ language: makeTsplLanguage() });

const paper58 = { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob } as const;

const rasterLabelPrinter = makePrinter({ kind: PrintKind.Label, language: makeTsplLanguage(), paper: paper58 });

/** Ảnh vuông toàn đen: chuẩn hoá về bề rộng 384px của giấy 58mm thì cao 384px, vượt chiều cao tem 30mm (240px). */
const squarePngBase64 = (): string => {
  const rgba = new Uint8Array(2 * 2 * 4);

  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    rgba[alpha] = 255;
  }

  return Buffer.from(new Uint8Array(UPNG.encode([rgba.buffer], 2, 2, 0, [], true))).toString('base64');
};

describe('TsplLanguage', () => {
  it('lệnh dò là ~!T và chỉ khớp khi máy có trả lời', () => {
    const probe = TsplLanguage.identifyProbe;

    expect(probe && Array.from(probe.command)).toEqual([0x7e, 0x21, 0x54, 0x0d, 0x0a]);
    expect(probe?.matches(new Uint8Array([]))).toBe(false);
    expect(probe?.matches(new Uint8Array([0x00]))).toBe(true);
  });

  it('số hàng không hợp lệ coi như 1 hàng', () => {
    const image = stripedPngBase64();
    const oneRow = fingerprintOf(TsplLanguage.encode(printer, image));

    expect(fingerprintOf(TsplLanguage.encode(printer, image, { rows: 0 }))).toBe(oneRow);
    expect(fingerprintOf(TsplLanguage.encode(printer, image, { rows: Number.NaN }))).toBe(oneRow);
  });

  it('ảnh cao hơn tem → IMAGE_TOO_LARGE', () => {
    expect(() => TsplLanguage.encode(rasterLabelPrinter, squarePngBase64())).toThrow(
      expect.objectContaining({ code: PrintErrorCode.IMAGE_TOO_LARGE }),
    );
  });

  it('cùng ảnh đó in hoá đơn giấy cuộn thì vẫn in được', () => {
    const receiptPrinter = { ...rasterLabelPrinter, kind: PrintKind.Receipt };

    expect(() => TsplLanguage.encode(receiptPrinter, squarePngBase64())).not.toThrow();
  });
});

const CONTINUOUS: PaperOptions = {
  type: PaperType.Continuous,
  paperSize: PaperSize.Mm80,
  cutterMode: CutterMode.PerJob,
};

const DIE_CUT: PaperOptions = {
  type: PaperType.DieCut,
  paperSize: PaperSize.Mm80,
  itemWidthMm: 30,
  itemHeightMm: 40,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
};

/** PNG 4x4 trắng hợp lệ (base64, không tiền tố `data:`). */
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEAQMAAACTPww9AAAAAXNSR0IB2cksfwAAAAZQTFRFAAAA/wAAG/+NIgAAAAJ0Uk5TAAB2k804' +
  'AAAAC0lEQVR4nGNggAAAAAgAAbdYc5UAAAAASUVORK5CYII=';

const printerWith = (paper: PaperOptions, kind: PrintKind = PrintKind.Receipt): Printer =>
  makePrinter({ kind, language: makeTsplLanguage(), paper });

/** Byte TSPL đọc như ASCII: phần lệnh luôn là ASCII, ảnh là byte thô không cần đọc. */
const asAscii = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('TsplLanguage.encode', () => {
  it('có ảnh → lệnh BITMAP và PRINT 1,1', () => {
    const text = asAscii(TsplLanguage.encode(printerWith(CONTINUOUS), TINY_PNG));

    expect(text).toContain('BITMAP');
    expect(text).toContain('PRINT 1,1');
  });

  it('tem rời 3 cột → 3 lệnh BITMAP tại x = 0, pitch, 2 × pitch', () => {
    // pitch = (30 + 2) × 8 = 256 dot
    const text = asAscii(TsplLanguage.encode(printerWith(DIE_CUT), TINY_PNG));

    expect((text.match(/BITMAP /g) ?? []).length).toBe(3);
    expect(text).toContain('BITMAP 0,0,');
    expect(text).toContain('BITMAP 256,0,');
    expect(text).toContain('BITMAP 512,0,');
    expect(text).toContain('PRINT 1,1');
  });

  it('tem rời → ảnh co theo bề rộng một con tem (itemWidthMm × 8)', () => {
    (decodePngBase64ToMonochrome as jest.Mock).mockClear();

    TsplLanguage.encode(printerWith(DIE_CUT), TINY_PNG);

    expect(decodePngBase64ToMonochrome).toHaveBeenCalledWith(TINY_PNG, 240);
  });

  it('base64 không phải PNG → IMAGE_INVALID', () => {

    expect(() => TsplLanguage.encode(printerWith(CONTINUOUS), 'bm90LWEtcG5n')).toThrow(
      expect.objectContaining({ code: PrintErrorCode.INVALID_IMAGE }),
    );
  });

  it('ảnh cao hơn tem → IMAGE_TOO_LARGE', () => {
    const tinyLabel = printerWith({ ...DIE_CUT, itemHeightMm: 0.01 }, PrintKind.Label);

    expect(() => TsplLanguage.encode(tinyLabel, TINY_PNG)).toThrow(
      expect.objectContaining({ code: PrintErrorCode.IMAGE_TOO_LARGE }),
    );
  });
});
