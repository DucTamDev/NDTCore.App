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
import type { PrintOptions } from '../../../models/printing/PrintOptions';
import { decodePngBase64ToMonochrome, type MonochromeBitmap } from '../../../rendering/MonochromeBitmap';

jest.mock('../../../rendering/MonochromeBitmap', () => {
  const actual = jest.requireActual('../../../rendering/MonochromeBitmap');
  return { __esModule: true, ...actual, decodePngBase64ToMonochrome: jest.fn(actual.decodePngBase64ToMonochrome) };
});

const printer = makePrinter({ language: makeTsplLanguage() });

const paper58 = { type: PaperType.Continuous, paperSize: PaperSize.Mm58, cutterMode: CutterMode.PerJob } as const;

const rasterLabelPrinter = makePrinter({ kind: PrintKind.Label, language: makeTsplLanguage(), paper: paper58 });

describe('TsplLanguage', () => {
  it('số bản không hợp lệ coi như 1 bản', () => {
    const image = stripedPngBase64();
    const oneRow = fingerprintOf(TsplLanguage.encode(printer, image));

    expect(fingerprintOf(TsplLanguage.encode(printer, image, { copies: 0 }))).toBe(oneRow);
    expect(fingerprintOf(TsplLanguage.encode(printer, image, { copies: Number.NaN }))).toBe(oneRow);
  });

  it('giấy cuộn: ảnh cao quá trần an toàn 200mm → IMAGE_TOO_LARGE', () => {
    const tall: MonochromeBitmap = { widthBytes: 1, heightPx: 200 * 8 + 1, bits: new Uint8Array(200 * 8 + 1) };

    expect(() => encodeBitmap(printerWith(continuous(PaperSize.Mm80)), tall)).toThrow(
      expect.objectContaining({ code: PrintErrorCode.IMAGE_TOO_LARGE }),
    );
  });

  it('loại nội dung không đổi SIZE: tem và hoá đơn trên cùng giấy cuộn khai như nhau', () => {
    const receipt = encodeBitmap({ ...rasterLabelPrinter, kind: PrintKind.Receipt }, TEN_MM);
    const label = encodeBitmap(rasterLabelPrinter, TEN_MM);

    expect(label).toEqual(receipt);
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

/** Encode với ảnh giải mã ra đúng `bitmap`, để kiểm tra lệnh mà không cần PNG thật. */
const encodeBitmap = (target: Printer, bitmap: MonochromeBitmap = ONE_DOT, options?: PrintOptions): Uint8Array => {
  (decodePngBase64ToMonochrome as jest.Mock).mockReturnValueOnce(bitmap);
  return TsplLanguage.encode(target, 'png', options);
};

const ONE_DOT: MonochromeBitmap = { widthBytes: 1, heightPx: 1, bits: new Uint8Array([0x00]) };

/** Ảnh cao đúng 10mm (80 dot). */
const TEN_MM: MonochromeBitmap = { widthBytes: 1, heightPx: 80, bits: new Uint8Array(80) };

const continuous = (paperSize: PaperSize, cutterMode: CutterMode = CutterMode.PerJob): PaperOptions => ({
  type: PaperType.Continuous,
  paperSize,
  cutterMode,
});

const DIE_CUT_100: PaperOptions = {
  type: PaperType.DieCut,
  paperSize: PaperSize.Mm100,
  itemWidthMm: 30,
  itemHeightMm: 20,
  columns: 3,
  horizontalGapMm: 2,
  verticalGapMm: 3,
};

describe('TsplLanguage.encode — lệnh TSPL', () => {
  it('giấy cuộn: SIZE rộng theo vùng in, cao đúng bằng nội dung, không dò khe', () => {
    const text = asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm58)), TEN_MM));

    expect(text).toContain('SIZE 50 mm, 10 mm');
    expect(text).toContain('GAP 0 mm, 0 mm');
    expect(text).toContain('CODEPAGE UTF-8');
    expect(text).toContain('CLS');
  });

  it('giấy cuộn: chiều cao nội dung làm tròn lên mm, tối thiểu 1mm', () => {
    const almostTwo: MonochromeBitmap = { widthBytes: 1, heightPx: 9, bits: new Uint8Array(9) };

    expect(asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm58)), almostTwo))).toContain('SIZE 50 mm, 2 mm');
    expect(asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm58)), ONE_DOT))).toContain('SIZE 50 mm, 1 mm');
  });

  it('giấy tem rời: SIZE bằng cả hàng tem theo cấu hình (không theo nội dung), GAP bằng khe dọc', () => {
    const text = asAscii(encodeBitmap(printerWith(DIE_CUT_100, PrintKind.Label), TEN_MM));

    expect(text).toContain('SIZE 94 mm, 20 mm'); // 3 × 30 + 2 × 2
    expect(text).toContain('GAP 3 mm, 0 mm');
  });

  it.each([
    [PaperSize.Mm100, 'SIZE 96 mm, 10 mm'],
    [PaperSize.Mm104, 'SIZE 104 mm, 10 mm'],
  ])('khổ %s → %s', (paperSize, size) => {
    expect(asAscii(encodeBitmap(printerWith(continuous(paperSize)), TEN_MM))).toContain(size);
  });

  it('cắt cuối job: SET CUTTER bằng số hàng rồi PRINT', () => {
    const text = asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm80)), ONE_DOT, { copies: 3 }));

    expect(text).toContain('SET CUTTER 3');
    expect(text.trim().endsWith('PRINT 3,1')).toBe(true);
  });

  it('cắt mỗi hàng: SET CUTTER 1', () => {
    const target = printerWith(continuous(PaperSize.Mm80, CutterMode.PerRow));
    const text = asAscii(encodeBitmap(target, ONE_DOT, { copies: 2 }));

    expect(text).toContain('SET CUTTER 1');
    expect(text).toContain('PRINT 2,1');
  });

  it('không cắt: gửi SET CUTTER OFF vì thiết lập dao cắt giữ qua các job', () => {
    const text = asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm80, CutterMode.None))));

    expect(text).toContain('SET CUTTER OFF');
    expect(text.trim().endsWith('PRINT 1,1')).toBe(true);
  });

  it('BITMAP: header theo byte, ảnh đảo bit, kết thúc CRLF', () => {
    const bits = new Uint8Array([0xff, 0x00, 0x80, 0x7f, 1, 0xfe]);
    const bitmap: MonochromeBitmap = { widthBytes: 2, heightPx: 3, bits };
    const bytes = encodeBitmap(printerWith(continuous(PaperSize.Mm80)), bitmap);
    const header = 'BITMAP 0,0,2,3,0,';
    const start = asAscii(bytes).indexOf(header) + header.length;

    expect(start).toBeGreaterThan(header.length - 1);
    // eslint-disable-next-line no-bitwise -- giống phép đảo bit đang kiểm tra
    expect(Array.from(bytes.slice(start, start + 6))).toEqual(Array.from(bitmap.bits, (byte) => byte ^ 0xff));
    expect(Array.from(bytes.slice(start + 6, start + 8))).toEqual([0x0d, 0x0a]);
  });
});

describe('TsplLanguage.encode — tùy chọn in', () => {
  it('copies: in đúng số bản', () => {
    const text = asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm80)), ONE_DOT, { copies: 4 }));

    expect(text).toContain('PRINT 4,1');
  });

  it('cut: false → SET CUTTER OFF dù giấy cấu hình cắt', () => {
    const text = asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm80)), ONE_DOT, { cut: false }));

    expect(text).toContain('SET CUTTER OFF');
  });

  it('feedMm: FEED theo dot sau PRINT', () => {
    const text = asAscii(encodeBitmap(printerWith(continuous(PaperSize.Mm80)), ONE_DOT, { feedMm: 5 }));

    expect(text.trim().endsWith('PRINT 1,1\r\nFEED 40')).toBe(true);
  });

  it('cashDrawer: máy tem không có ngăn kéo nên không đổi byte', () => {
    const target = printerWith(continuous(PaperSize.Mm80));

    expect(encodeBitmap(target, ONE_DOT, { cashDrawer: true })).toEqual(encodeBitmap(target, ONE_DOT));
  });
});
