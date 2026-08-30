import { TsplInternalFontStrategy } from '../TsplInternalFontStrategy';
import type { TsplStrategyContext } from '../tsplStrategy.types';
import { PrinterErrorCode } from '../../../../types/PrinterError';
import { PrinterDriverType, TsplRenderMode } from '../../../../types/printer.types';
import { PrintType } from '../../../../types/printConfiguration.types';
import type { Printer, PrinterDriver } from '../../../../types/printer.types';

const printer: Printer = {
  id: 'p1', name: 'M', drivers: [], connectionType: 'lan' as Printer['connectionType'],
  lan: { ip: '1.2.3.4', port: 9100 }, identityKey: 'k', paperSize: 80,
  autoReconnect: false, enabled: true, createdAt: '', updatedAt: '',
};
const withConfig = (config: PrinterDriver['config']): PrinterDriver => ({
  type: PrinterDriverType.tspl, source: 'auto' as PrinterDriver['source'], contentTypes: [PrintType.Receipt], config,
});
const configured = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, internalFont: { codepage: '1258', fontName: 'TSS24.BF2' } });
const missing = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont });
const bitmapMode = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.bitmap });

const ctx = (driver: PrinterDriver): TsplStrategyContext => ({
  printer, driver,
  documents: { text: { elements: [{ type: 'text', content: 'Trà sữa', x: 0, y: 0 }] } },
  printType: PrintType.Receipt, heightMm: 200,
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
    expect(ascii).toContain('PRINT');
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
    const utf8 = withConfig({ type: PrinterDriverType.tspl, renderMode: TsplRenderMode.internalfont, internalFont: { codepage: 'UTF-8', fontName: '3' } });
    const ascii = Array.from(s.encode(ctx(utf8))).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('CODEPAGE UTF-8');
  });

  it('encode ném TSPL_ELEMENT_UNSUPPORTED cho element lạ', () => {
    const bad = { ...ctx(configured), documents: { text: { elements: [{ type: 'weird', x: 0, y: 0 } as never] } } };
    expect(() => s.encode(bad)).toThrow();
  });
});
