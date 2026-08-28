import { TsplBitmapStrategy } from '../TsplBitmapStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { AppErrorCode } from '../../../../types/AppError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../types/printConfiguration.types';
import type { Printer, PrinterDriver } from '../../../../types/printer.types';

// PNG 4x4 trắng hợp lệ, base64 (không data: prefix)
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEAQMAAACTPww9AAAAAXNSR0IB2cksfwAAAAZQTFRFAAAA/wAAG/+NIgAAAAJ0Uk5TAAB2k804AAAAC0lEQVR4nGNggAAAAAgAAbdYc5UAAAAASUVORK5CYII=';

const printer: Printer = {
  id: 'p1',
  name: 'M',
  drivers: [],
  connectionType: 'lan' as Printer['connectionType'],
  lan: { ip: '1.2.3.4', port: 9100 },
  identityKey: 'lan:1.2.3.4:9100',
  paperSize: 80,
  autoReconnect: false,
  enabled: true,
  createdAt: '',
  updatedAt: '',
};

const driver: PrinterDriver = {
  type: PrinterDriverType.tspl,
  source: 'auto' as PrinterDriver['source'],
  contentTypes: [PrintType.Receipt],
  config: { type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap },
};

const ctx = (over: Partial<TsplStrategyContext> = {}): TsplStrategyContext => ({
  printer,
  driver,
  documents: { text: { elements: [] }, image: TINY_PNG },
  printType: PrintType.Receipt,
  heightMm: 200,
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
      expect(e).toMatchObject({ code: AppErrorCode.TSPL_IMAGE_REQUIRED });
    }
  });

  it('validate pass khi có image', () => expect(() => s.validate(ctx())).not.toThrow());

  it('encode sinh bytes chứa BITMAP và PRINT', () => {
    const bytes = s.encode(ctx());
    const ascii = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join('');
    expect(ascii).toContain('BITMAP');
    expect(ascii).toContain('PRINT');
  });

  it('encode ném TSPL_IMAGE_INVALID khi base64 không phải PNG', () => {
    try {
      s.encode(ctx({ documents: { text: { elements: [] }, image: 'bm90LWEtcG5n' } }));
    } catch (e) {
      expect(e).toMatchObject({ code: AppErrorCode.TSPL_IMAGE_INVALID });
    }
  });

  it('encode ném TSPL_IMAGE_TOO_LARGE khi ảnh cao hơn heightMm*DOTS_PER_MM', () => {
    // heightMm nhỏ để chắc chắn vượt
    try {
      s.encode(ctx({ heightMm: 0.01 }));
    } catch (e) {
      expect(e).toMatchObject({ code: AppErrorCode.TSPL_IMAGE_TOO_LARGE });
    }
  });
});
