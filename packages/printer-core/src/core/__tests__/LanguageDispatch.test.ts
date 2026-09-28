import { compileTo, parseFrom, validateFor, previewFor } from '../LanguageDispatch';
import { UnsupportedLanguageError } from '../PrinterCoreError';
import type { ResolvedPrintDocument } from '../../document';
import { bytesToBinaryString } from '../../encoding';

const doc: ResolvedPrintDocument = {
  widthDots: 320,
  heightDots: 240,
  dpi: 203,
  gapDots: 24,
  speed: 4,
  density: 8,
  direction: 'forward',
  copies: 1,
  elements: [{ type: 'text', content: 'Hi', options: {} }],
};

describe('LanguageDispatch', () => {
  it('compileTo trả output kèm danh sách cảnh báo', () => {
    const result = compileTo('tspl', doc);

    expect(typeof result.output).toBe('string');
    expect(result.warnings).toEqual([]);
  });

  it('routes "tspl" to TsplCompiler/TsplParser/TsplValidator/TsplPreviewRenderer', () => {
    const tspl = compileTo('tspl', doc).output;
    expect(typeof tspl).toBe('string');
    expect(parseFrom('tspl', tspl as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('tspl', tspl as string).valid).toBe(true);
    expect(previewFor('tspl', doc)).toContain('<svg');
  });

  it('routes "escpos" to EscPosCompiler/EscPosParser/EscPosValidator/EscPosPreviewRenderer', () => {
    const bytes = compileTo('escpos', doc).output;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(parseFrom('escpos', bytes as Uint8Array).commands.length).toBeGreaterThan(0);
    expect(previewFor('escpos', doc)).toContain('<svg');
  });

  it('parseFrom đọc ESC/POS dạng chuỗi 1 ký tự = 1 byte giống hệt dạng byte', () => {
    const bytes = compileTo('escpos', doc).output as Uint8Array;
    const fromBytes = parseFrom('escpos', bytes);

    const fromString = parseFrom('escpos', bytesToBinaryString(bytes));

    expect(fromString.commands.length).toBeGreaterThan(0);
    expect(fromString).toEqual(fromBytes);
  });

  it('parseFrom trả element và khổ tem dựng lại từ lệnh TSPL', () => {
    const result = parseFrom('tspl', compileTo('tspl', doc).output as string);

    expect(result.widthDots).toBe(320);
    expect(result.heightDots).toBe(240);
    expect(result.elements).toContainEqual(expect.objectContaining({ type: 'text', content: 'Hi' }));
  });

  it('throws a clear UnsupportedLanguageError for an unknown language', () => {
    const unknown = 'unknown' as unknown as Parameters<typeof compileTo>[0];
    expect(() => compileTo(unknown, doc).output).toThrow(UnsupportedLanguageError);
    expect(() => parseFrom(unknown, '')).toThrow(UnsupportedLanguageError);
    expect(() => validateFor(unknown, '')).toThrow(UnsupportedLanguageError);
    expect(() => previewFor(unknown, doc)).toThrow(UnsupportedLanguageError);
  });

  it('compileTo dùng chung compiler đã đăng ký nhưng cảnh báo không dồn sang lần compile sau', () => {
    compileTo('escpos', { ...doc, elements: [{ type: 'circle', options: { x: 0, y: 0, diameter: 10 } }] });

    expect(compileTo('escpos', doc).warnings).toEqual([]);
  });
});
