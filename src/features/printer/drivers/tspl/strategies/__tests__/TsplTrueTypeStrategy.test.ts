import { TsplTrueTypeStrategy } from '../TsplTrueTypeStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { PrinterErrorCode } from '../../../../types/PrinterError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../types/printConfiguration.types';
import type { Printer, PrinterDriver } from '../../../../types/printer.types';

const printer: Printer = {
  id: 'p1', name: 'M', drivers: [], connectionType: 'lan' as Printer['connectionType'],
  lan: { ip: '1.2.3.4', port: 9100 }, identityKey: 'k', capabilities: { cutter: false },
  autoReconnect: false, enabled: true, createdAt: '', updatedAt: '',
};
const MEDIA = { type: 'continuous', paperSize: 80 } as const;
const withConfig = (config: PrinterDriver['config']): PrinterDriver => ({
  type: PrinterDriverType.tspl, source: 'auto' as PrinterDriver['source'], contentTypes: [PrintType.Receipt], config,
});
const installed = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { ...MEDIA }, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: true } });
const notInstalled = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { ...MEDIA }, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: false } });
const bitmapMode = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { ...MEDIA } });

const ctx = (driver: PrinterDriver): TsplStrategyContext => ({
  printer, driver,
  documents: { text: { elements: [{ type: 'text', content: 'Xin chào', x: 0, y: 0 }] } },
  printType: PrintType.Receipt, media: { ...MEDIA }, rows: 1,
});

describe('TsplTrueTypeStrategy', () => {
  const s = new TsplTrueTypeStrategy();

  it('mode === truetype', () => expect(s.mode).toBe(TsplRenderMode.truetype));

  it('validate ném TSPL_FONT_NOT_INSTALLED khi fontInstalled=false', () => {
    try { s.validate(ctx(notInstalled)); } catch (e) { expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_FONT_NOT_INSTALLED }); }
    expect(() => s.validate(ctx(notInstalled))).toThrow();
  });

  it('validate ném TSPL_FONT_NOT_INSTALLED khi renderMode=bitmap (gọi nhầm strategy)', () => {
    expect(() => s.validate(ctx(bitmapMode))).toThrow();
  });

  it('validate pass khi fontInstalled=true', () => expect(() => s.validate(ctx(installed))).not.toThrow());

  it('encode dùng font.name trong lệnh TEXT, có PRINT, KHÔNG có BITMAP, KHÔNG có DOWNLOAD', () => {
    const ascii = Array.from(s.encode(ctx(installed))).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('"VIETFONT"');
    expect(ascii).toContain('PRINT 1,1');
    expect(ascii).not.toContain('BITMAP');
    expect(ascii).not.toContain('DOWNLOAD');
  });

  it('die_cut 2 cột → mỗi element xuất hiện 2 lần, lần 2 tại x = element.x + pitch', () => {
    const dieCut = { type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3 } as const;
    const dieCutDriver = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { ...dieCut }, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: true } });
    const dieCtx: TsplStrategyContext = {
      printer, driver: dieCutDriver,
      documents: { text: { elements: [{ type: 'text', content: 'A', x: 10, y: 0 }] } },
      printType: PrintType.Receipt, media: { ...dieCut }, rows: 1,
    };
    const ascii = Array.from(s.encode(dieCtx)).map((b) => String.fromCharCode(b)).join('');
    // pitch = (30 + 2) * 8 = 256 → cột 2 tại x = 10 + 256 = 266
    expect(ascii).toContain('TEXT 10,0,');
    expect(ascii).toContain('TEXT 266,0,');
  });

  it('encode ném TSPL_ELEMENT_UNSUPPORTED cho element lạ', () => {
    const bad = { ...ctx(installed), documents: { text: { elements: [{ type: 'weird', x: 0, y: 0 } as never] } } };
    try { s.encode(bad); } catch (e) { expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED }); }
    expect(() => s.encode(bad)).toThrow();
  });
});
