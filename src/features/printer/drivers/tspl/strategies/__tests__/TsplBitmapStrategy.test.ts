import { TsplBitmapStrategy } from '../TsplBitmapStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { PrinterErrorCode } from '../../../../errors/PrinterError';
import { RenderMode } from '../../../../models/printer/PrinterDriver';
import { PrintType } from '../../../../models/printing/PrintType';
import type { Printer } from '../../../../models/printer/Printer';
import type { PrintPaperConfig } from '../../../../models/paper/PrintPaperConfig';
import { makePrinter, makeTsplDriver } from '../../../../testing/printerFixtures';
import { decodePngBase64ToMonochrome } from '../../../../utils/pngToMonochrome';

jest.mock('../../../../utils/pngToMonochrome', () => {
  const actual = jest.requireActual('../../../../utils/pngToMonochrome');
  return { __esModule: true, ...actual, decodePngBase64ToMonochrome: jest.fn(actual.decodePngBase64ToMonochrome) };
});

const MEDIA: PrintPaperConfig = { type: 'Continuous', paperSize: 80 };

const DIE_CUT: PrintPaperConfig = { type: 'DieCut', paperSize: 80, itemWidthMm: 30, itemHeightMm: 40, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 };

// PNG 4x4 trắng hợp lệ, base64 (không data: prefix)
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEAQMAAACTPww9AAAAAXNSR0IB2cksfwAAAAZQTFRFAAAA/wAAG/+NIgAAAAJ0Uk5TAAB2k804AAAAC0lEQVR4nGNggAAAAAgAAbdYc5UAAAAASUVORK5CYII=';

const printer: Printer = makePrinter({
  id: 'p1',
  name: 'M',
  driver: makeTsplDriver({ config: { renderMode: RenderMode.Bitmap } }),
  paper: MEDIA,
});

const ctx = (over: Partial<TsplStrategyContext> = {}): TsplStrategyContext => ({
  printer,
  documents: { text: { elements: [] }, image: TINY_PNG },
  printType: PrintType.Receipt,
  paper: MEDIA,
  rows: 1,
  ...over,
});

describe('TsplBitmapStrategy', () => {
  const s = new TsplBitmapStrategy();

  it('mode === Bitmap', () => expect(s.mode).toBe(RenderMode.Bitmap));

  it('validate ném IMAGE_REQUIRED khi thiếu documents.image', () => {
    expect(() => s.validate(ctx({ documents: { text: { elements: [] } } }))).toThrow();
    try {
      s.validate(ctx({ documents: { text: { elements: [] } } }));
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.IMAGE_REQUIRED });
    }
  });

  it('validate pass khi có image', () => expect(() => s.validate(ctx())).not.toThrow());

  it('encode sinh bytes chứa BITMAP và PRINT 1,1', () => {
    const bytes = s.encode(ctx());
    const ascii = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join('');
    expect(ascii).toContain('BITMAP');
    expect(ascii).toContain('PRINT 1,1');
  });

  it('die_cut 3 cột → 3 lệnh BITMAP tại x = 0, pitch, 2*pitch; PRINT rows,1', () => {
    // pitch = (30 + 2) * 8 = 256
    const ascii = Array.from(s.encode(ctx({ paper: DIE_CUT })))
      .map((b) => String.fromCharCode(b))
      .join('');
    expect((ascii.match(/BITMAP /g) ?? []).length).toBe(3);
    expect(ascii).toContain('BITMAP 0,0,');
    expect(ascii).toContain('BITMAP 256,0,');
    expect(ascii).toContain('BITMAP 512,0,');
    expect(ascii).toContain('PRINT 1,1');
  });

  it('die_cut → decode ảnh ở width = itemWidthMm * 8', () => {
    (decodePngBase64ToMonochrome as jest.Mock).mockClear();
    s.encode(ctx({ paper: DIE_CUT }));
    expect(decodePngBase64ToMonochrome).toHaveBeenCalledWith(TINY_PNG, 240);
  });

  it('encode ném IMAGE_INVALID khi base64 không phải PNG', () => {
    expect(() => s.encode(ctx({ documents: { text: { elements: [] }, image: 'bm90LWEtcG5n' } }))).toThrow();
    try {
      s.encode(ctx({ documents: { text: { elements: [] }, image: 'bm90LWEtcG5n' } }));
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.IMAGE_INVALID });
    }
  });

  it('encode ném IMAGE_TOO_LARGE khi ảnh cao hơn resolveSizeHeightMm(paper)*DOTS_PER_MM', () => {
    // itemHeightMm cực nhỏ + Label để resolveSizeHeightMm ra ~0 → chắc chắn vượt.
    const tiny: Partial<TsplStrategyContext> = {
      paper: { type: 'Continuous', paperSize: 80, itemHeightMm: 0.01 },
      printType: PrintType.Label,
    };
    expect(() => s.encode(ctx(tiny))).toThrow();
    try {
      s.encode(ctx(tiny));
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.IMAGE_TOO_LARGE });
    }
  });
});
