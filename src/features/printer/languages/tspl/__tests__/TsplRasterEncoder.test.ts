import { encodeTsplRaster } from '../TsplRasterEncoder';
import { PrinterErrorCode } from '../../../errors/PrinterError';
import { RenderMode } from '../../../models/printer/PrinterLanguage';
import { PrintKind } from '../../../models/printer/PrintKind';
import type { Printer } from '../../../models/printer/Printer';
import { CutterMode, PaperSize, PaperType, type PaperOptions } from '../../../models/paper/PaperOptions';
import type { PrintDocuments } from '../../../models/printing/PrintDocuments';
import { makePrinter, makeTsplLanguage } from '../../../testing/printerFixtures';
import { decodePngBase64ToMonochrome } from '../../../rendering/MonochromeBitmap';

jest.mock('../../../rendering/MonochromeBitmap', () => {
  const actual = jest.requireActual('../../../rendering/MonochromeBitmap');
  return { __esModule: true, ...actual, decodePngBase64ToMonochrome: jest.fn(actual.decodePngBase64ToMonochrome) };
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

const withImage: PrintDocuments = { text: { elements: [] }, image: TINY_PNG };

const printerWith = (paper: PaperOptions, kind: PrintKind = PrintKind.Receipt): Printer =>
  makePrinter({ kind, language: makeTsplLanguage({ renderMode: RenderMode.Raster }), paper });

/** Byte TSPL đọc như ASCII: phần lệnh luôn là ASCII, ảnh là byte thô không cần đọc. */
const asAscii = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('encodeTsplRaster', () => {
  it('thiếu ảnh → IMAGE_REQUIRED', () => {
    expect(() => encodeTsplRaster(printerWith(CONTINUOUS), { text: { elements: [] } }, 1)).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_REQUIRED }),
    );
  });

  it('có ảnh → lệnh BITMAP và PRINT 1,1', () => {
    const text = asAscii(encodeTsplRaster(printerWith(CONTINUOUS), withImage, 1));

    expect(text).toContain('BITMAP');
    expect(text).toContain('PRINT 1,1');
  });

  it('tem rời 3 cột → 3 lệnh BITMAP tại x = 0, pitch, 2 × pitch', () => {
    // pitch = (30 + 2) × 8 = 256 dot
    const text = asAscii(encodeTsplRaster(printerWith(DIE_CUT), withImage, 1));

    expect((text.match(/BITMAP /g) ?? []).length).toBe(3);
    expect(text).toContain('BITMAP 0,0,');
    expect(text).toContain('BITMAP 256,0,');
    expect(text).toContain('BITMAP 512,0,');
    expect(text).toContain('PRINT 1,1');
  });

  it('tem rời → ảnh co theo bề rộng một con tem (itemWidthMm × 8)', () => {
    (decodePngBase64ToMonochrome as jest.Mock).mockClear();

    encodeTsplRaster(printerWith(DIE_CUT), withImage, 1);

    expect(decodePngBase64ToMonochrome).toHaveBeenCalledWith(TINY_PNG, 240);
  });

  it('base64 không phải PNG → IMAGE_INVALID', () => {
    const documents: PrintDocuments = { text: { elements: [] }, image: 'bm90LWEtcG5n' };

    expect(() => encodeTsplRaster(printerWith(CONTINUOUS), documents, 1)).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_INVALID }),
    );
  });

  it('ảnh cao hơn tem → IMAGE_TOO_LARGE', () => {
    const tinyLabel = printerWith({ ...DIE_CUT, itemHeightMm: 0.01 }, PrintKind.Label);

    expect(() => encodeTsplRaster(tinyLabel, withImage, 1)).toThrow(
      expect.objectContaining({ code: PrinterErrorCode.IMAGE_TOO_LARGE }),
    );
  });
});
