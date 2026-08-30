import { TsplBitmapStrategy } from '../TsplBitmapStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { PrinterErrorCode } from '../../../../types/PrinterError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../types/printConfiguration.types';
import type { Printer, PrinterDriver, PrintMedia } from '../../../../types/printer.types';
import { decodePngBase64ToMonochrome } from '../../../../utils/pngToMonochrome';

jest.mock('../../../../utils/pngToMonochrome', () => {
  const actual = jest.requireActual('../../../../utils/pngToMonochrome');
  return { __esModule: true, ...actual, decodePngBase64ToMonochrome: jest.fn(actual.decodePngBase64ToMonochrome) };
});

const MEDIA: PrintMedia = { type: 'continuous', paperSize: 80 };

const DIE_CUT: PrintMedia = { type: 'die_cut', paperSize: 80, itemWidthMm: 30, itemHeightMm: 40, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 };

// PNG 4x4 trắng hợp lệ, base64 (không data: prefix)
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEAQMAAACTPww9AAAAAXNSR0IB2cksfwAAAAZQTFRFAAAA/wAAG/+NIgAAAAJ0Uk5TAAB2k804AAAAC0lEQVR4nGNggAAAAAgAAbdYc5UAAAAASUVORK5CYII=';

const printer: Printer = {
  id: 'p1',
  name: 'M',
  drivers: [],
  connectionType: 'lan' as Printer['connectionType'],
  lan: { ip: '1.2.3.4', port: 9100 },
  identityKey: 'lan:1.2.3.4:9100',
  capabilities: { cutter: false },
  autoReconnect: false,
  enabled: true,
  createdAt: '',
  updatedAt: '',
};

const driver: PrinterDriver = {
  type: PrinterDriverType.tspl,
  source: 'auto' as PrinterDriver['source'],
  contentTypes: [PrintType.Receipt],
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { type: 'continuous', paperSize: 80 } },
};

const ctx = (over: Partial<TsplStrategyContext> = {}): TsplStrategyContext => ({
  printer,
  driver,
  documents: { text: { elements: [] }, image: TINY_PNG },
  printType: PrintType.Receipt,
  media: MEDIA,
  rows: 1,
  ...over,
});

describe('TsplBitmapStrategy', () => {
  const s = new TsplBitmapStrategy();

  it('mode === bitmap', () => expect(s.mode).toBe(TsplRenderMode.bitmap));

  it('validate ném TSPL_IMAGE_REQUIRED khi thiếu documents.image', () => {
    expect(() => s.validate(ctx({ documents: { text: { elements: [] } } }))).toThrow();
    try {
      s.validate(ctx({ documents: { text: { elements: [] } } }));
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_IMAGE_REQUIRED });
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
    const ascii = Array.from(s.encode(ctx({ media: DIE_CUT })))
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
    s.encode(ctx({ media: DIE_CUT }));
    expect(decodePngBase64ToMonochrome).toHaveBeenCalledWith(TINY_PNG, 240);
  });

  it('encode ném TSPL_IMAGE_INVALID khi base64 không phải PNG', () => {
    expect(() => s.encode(ctx({ documents: { text: { elements: [] }, image: 'bm90LWEtcG5n' } }))).toThrow();
    try {
      s.encode(ctx({ documents: { text: { elements: [] }, image: 'bm90LWEtcG5n' } }));
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_IMAGE_INVALID });
    }
  });

  it('encode ném TSPL_IMAGE_TOO_LARGE khi ảnh cao hơn resolveSizeHeightMm(media)*DOTS_PER_MM', () => {
    // itemHeightMm cực nhỏ + Label để resolveSizeHeightMm ra ~0 → chắc chắn vượt.
    const tiny: Partial<TsplStrategyContext> = {
      media: { type: 'continuous', paperSize: 80, itemHeightMm: 0.01 },
      printType: PrintType.Label,
    };
    expect(() => s.encode(ctx(tiny))).toThrow();
    try {
      s.encode(ctx(tiny));
    } catch (e) {
      expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_IMAGE_TOO_LARGE });
    }
  });
});
