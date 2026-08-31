import { TsplTrueTypeStrategy } from '../TsplTrueTypeStrategy';
import { contentWidthChars } from '../../TsplEncoder';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import type { PrintMedia } from '../../../../models/media/PrintMedia';
import { PrinterErrorCode } from '../../../../errors/PrinterError';
import { PrinterDriverType, TsplRenderMode } from '../../../../models/printer/PrinterDriver';
import { PrintType } from '../../../../models/printing/PrintType';
import type { Printer } from '../../../../models/printer/Printer';
import type { PrinterDriver } from '../../../../models/printer/PrinterDriver';

const printer: Printer = {
  id: 'p1', name: 'M', drivers: [], connection: { type: 'lan' as Printer['connection']['type'], lan: { ip: '1.2.3.4', port: 9100 } },
  identityKey: 'k', capabilities: { cutter: false },
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

  it('die_cut: line/row element dùng contentWidthChars (không phải bề rộng cả tờ giấy) và cũng nhân theo cột với offset +dx', () => {
    const dieCut = { type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3 } as PrintMedia;
    const width = contentWidthChars(dieCut);
    expect(width).toBeLessThan(64); // < PAPER_SIZE_SPECS[100].charsPerLine, tức không tràn cột
    const dieCutDriver = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.truetype, media: { ...dieCut }, font: { name: 'VIETFONT', fileName: 'Roboto-Regular.ttf', fontInstalled: true } });
    const dieCtx: TsplStrategyContext = {
      printer, driver: dieCutDriver,
      documents: { text: { elements: [
        { type: 'text', content: 'A', x: 10, y: 0 },
        { type: 'line', x: 10, y: 20 },
        { type: 'row', left: 'L', right: 'R', x: 10, y: 40 },
      ] } },
      printType: PrintType.Receipt, media: { ...dieCut }, rows: 1,
    };
    const ascii = Array.from(s.encode(dieCtx)).map((b) => String.fromCharCode(b)).join('');
    // (a) dấu gạch của `line` dài đúng contentWidthChars, không phải bề rộng cả tờ
    expect(ascii).toContain(`,"${'-'.repeat(width)}"`);
    expect(ascii).not.toContain(`,"${'-'.repeat(64)}"`);
    // (b) line + row (+ text) mỗi cái xuất hiện đúng `columns` lần
    expect((ascii.match(new RegExp(`,"${'-'.repeat(width)}"`, 'g')) ?? []).length).toBe(2);
    expect((ascii.match(/TEXT \d+,0,/g) ?? []).length).toBe(2);
    expect((ascii.match(/TEXT \d+,20,/g) ?? []).length).toBe(2);
    expect((ascii.match(/TEXT \d+,40,/g) ?? []).length).toBe(2);
    // (c) offset +dx (pitch = 256) áp cho line/row/text
    expect(ascii).toContain('TEXT 10,20,');
    expect(ascii).toContain('TEXT 266,20,');
    expect(ascii).toContain('TEXT 10,40,');
    expect(ascii).toContain('TEXT 266,40,');
  });

  it('encode ném TSPL_ELEMENT_UNSUPPORTED cho element lạ', () => {
    const bad = { ...ctx(installed), documents: { text: { elements: [{ type: 'weird', x: 0, y: 0 } as never] } } };
    try { s.encode(bad); } catch (e) { expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED }); }
    expect(() => s.encode(bad)).toThrow();
  });
});
