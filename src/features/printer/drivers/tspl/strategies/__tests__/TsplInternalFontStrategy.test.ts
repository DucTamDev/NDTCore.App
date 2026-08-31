import { TsplInternalFontStrategy } from '../TsplInternalFontStrategy';
import { contentWidthChars } from '../../TsplEncoder';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import type { PrintMedia } from '../../../../types/printer.types';
import { PrinterErrorCode } from '../../../../errors/PrinterError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../models/printing/PrintType';
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
const configured = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, media: { ...MEDIA }, internalFont: { codepage: '1258', fontName: 'TSS24.BF2' } });
const missing = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, media: { ...MEDIA } });
const bitmapMode = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap, media: { ...MEDIA } });

const ctx = (driver: PrinterDriver): TsplStrategyContext => ({
  printer, driver,
  documents: { text: { elements: [{ type: 'text', content: 'Trà sữa', x: 0, y: 0 }] } },
  printType: PrintType.Receipt, media: { ...MEDIA }, rows: 1,
});

describe('TsplInternalFontStrategy', () => {
  const s = new TsplInternalFontStrategy();

  it('mode === internalfont', () => expect(s.mode).toBe(TsplRenderMode.internalfont));

  it('validate ném TSPL_RENDER_MODE_UNSUPPORTED khi thiếu internalFont', () => {
    try { s.validate(ctx(missing)); } catch (e) { expect(e).toMatchObject({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED }); }
    expect(() => s.validate(ctx(missing))).toThrow();
  });

  it('validate ném khi renderMode=bitmap (gọi nhầm strategy)', () => {
    expect(() => s.validate(ctx(bitmapMode))).toThrow();
  });

  it('validate pass khi có internalFont', () => expect(() => s.validate(ctx(configured))).not.toThrow());

  it('encode: CODEPAGE 1258, font trong TEXT, có PRINT, KHÔNG BITMAP/DOWNLOAD', () => {
    const bytes = s.encode(ctx(configured));
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('CODEPAGE 1258');
    expect(ascii).toContain('"TSS24.BF2"');
    expect(ascii).toContain('PRINT 1,1');
    expect(ascii).not.toContain('BITMAP');
    expect(ascii).not.toContain('DOWNLOAD');
  });

  it('encode: nội dung "Trà sữa" thành byte CP1258 (nền + thanh tổ hợp), không UTF-8', () => {
    const bytes = Array.from(s.encode(ctx(configured)));
    // "Trà sữa" = T r à(0xE0) ' ' s ữ(0xFD 0xDE) a
    const needle = [0x54, 0x72, 0xe0, 0x20, 0x73, 0xfd, 0xde, 0x61];
    const joined = bytes.join(',');
    expect(joined).toContain(needle.join(','));
  });

  it('encode dùng CODEPAGE UTF-8 khi codepage là UTF-8', () => {
    const utf8 = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, media: { ...MEDIA }, internalFont: { codepage: 'UTF-8', fontName: '3' } });
    const ascii = Array.from(s.encode(ctx(utf8))).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('CODEPAGE UTF-8');
  });

  it('die_cut 2 cột → mỗi element xuất hiện 2 lần, lần 2 tại x = element.x + pitch', () => {
    const dieCut = { type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3 } as const;
    const dieCutDriver = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, media: { ...dieCut }, internalFont: { codepage: '1258', fontName: 'TSS24.BF2' } });
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

  it('die_cut: line/row element dùng contentWidthChars (không tràn cột) và nhân theo cột với offset +dx', () => {
    const dieCut = { type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3 } as PrintMedia;
    const width = contentWidthChars(dieCut);
    expect(width).toBeLessThan(64);
    const dieCutDriver = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, media: { ...dieCut }, internalFont: { codepage: '1258', fontName: 'TSS24.BF2' } });
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
    expect(ascii).toContain(`,"${'-'.repeat(width)}"`);
    expect(ascii).not.toContain(`,"${'-'.repeat(64)}"`);
    expect((ascii.match(new RegExp(`,"${'-'.repeat(width)}"`, 'g')) ?? []).length).toBe(2);
    expect((ascii.match(/TEXT \d+,20,/g) ?? []).length).toBe(2);
    expect((ascii.match(/TEXT \d+,40,/g) ?? []).length).toBe(2);
    expect(ascii).toContain('TEXT 10,20,');
    expect(ascii).toContain('TEXT 266,20,');
    expect(ascii).toContain('TEXT 10,40,');
    expect(ascii).toContain('TEXT 266,40,');
  });

  it('encode ném TSPL_ELEMENT_UNSUPPORTED cho element lạ', () => {
    const bad = { ...ctx(configured), documents: { text: { elements: [{ type: 'weird', x: 0, y: 0 } as never] } } };
    expect(() => s.encode(bad)).toThrow();
  });
});
