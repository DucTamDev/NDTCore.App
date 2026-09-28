import { TsplCompiler } from '../language/tspl/TsplCompiler';
import { TsplParser } from '../language/tspl/TsplParser';
import { TsplValidator } from '../validation/languages/tspl/TsplValidator';
import { EscPosCompiler } from '../language/escpos/EscPosCompiler';
import { EscPosParser } from '../language/escpos/EscPosParser';
import { compileTo, parseFrom, previewFor, validateFor } from '../registry';
import type { PrinterLanguage } from '../core/PrinterLanguage';
import type { ResolvedPrintDocument } from '../document';

// Mô phỏng document 40mm × 30mm @ 203 dpi để test hành vi compile thật của `.cut` và `.table`.
const doc: ResolvedPrintDocument = {
  widthDots: 320,
  heightDots: 240,
  dpi: 203,
  gapDots: 24,
  speed: 4,
  density: 8,
  direction: 'forward',
  copies: 1,
  elements: [
    { type: 'text', content: 'Hello World', options: { x: 10, y: 10, fontSize: 24 } },
    { type: 'barcode', options: { symbology: 'code128', content: '123456789' } },
    {
      type: 'table',
      options: {
        x: 0,
        y: 80,
        columns: [
          { width: 10, align: 'left' },
          { width: 6, align: 'right' },
        ],
        rows: [['Coffee', '25000']],
      },
    },
    { type: 'cut', options: { mode: 'full' } },
  ],
};

describe('Phase 1 end-to-end', () => {
  it('compiles, parses, and validates a document as TSPL', () => {
    const tspl = new TsplCompiler().compile(doc).output;
    expect(new TsplValidator().validate(tspl).valid).toBe(true);
    expect(new TsplParser().parse(tspl).commands.length).toBeGreaterThan(0);

    // `cut` compiles to a `SET CUTTER` command (mode 'full', rows defaulted to 1).
    const lines = tspl.trim().split('\r\n');
    expect(lines).toContain('SET CUTTER 1');

    // `table` compiles its rows into real TEXT commands carrying the cell content.
    expect(tspl).toContain('Coffee');
    expect(tspl).toContain('25000');
  });

  it('compiles and parses the same document as ESC/POS', () => {
    const bytes = new EscPosCompiler().compile(doc).output;
    expect(new EscPosParser().parse(bytes).commands.length).toBeGreaterThan(0);

    // `cut` compiles to a `GS V m` sequence (mode 'full', no explicit rows -> function A, m=0x00).
    expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x00]));

    // `table` compiles its rows into real text bytes carrying the cell content.
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Coffee');
    expect(text).toContain('25000');
  });
});

// ESC/POS compile ra `Uint8Array` (giao thức nhị phân), TSPL ra `string`; validateFor chỉ nhận chuỗi.
const ALL_LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'escpos'];
const BINARY_LANGUAGES = new Set<PrinterLanguage>(['escpos']);

describe('Phase 2 end-to-end: mọi ngôn ngữ được hỗ trợ', () => {
  describe.each(ALL_LANGUAGES)('%s', (language) => {
    it('compiles, parses, validates, and previews the representative document', () => {
      const compiled = compileTo(language, doc).output;
      const isBinary = BINARY_LANGUAGES.has(language);
      expect(compiled instanceof Uint8Array).toBe(isBinary);

      expect(compiled.length).toBeGreaterThan(0);

      const parsed = parseFrom(language, compiled);
      expect(parsed.commands.length).toBeGreaterThan(0);

      // Binary-protocol languages don't accept a byte stream through
      // `validateFor` (its contract is a string source) — matches the
      // split already established by `LanguageDispatch`'s own unit test.
      if (!isBinary) {
        const validation = validateFor(language, compiled as string);
        expect(validation.errors).toBe(0);
      }

      const preview = previewFor(language, doc);
      expect(preview).toContain('<svg');
      expect(preview.length).toBeGreaterThan(0);
    });
  });
});
