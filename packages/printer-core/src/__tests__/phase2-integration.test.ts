import { LabelBuilder } from '../builder/LabelBuilder';
import { TscCompiler } from '../compiler/tsc/TscCompiler';
import { TscParser } from '../parser/tsc/TscParser';
import { TscValidator } from '../validation/tsc/TscValidator';
import { EscPosCompiler } from '../compiler/escpos/EscPosCompiler';
import { EscPosParser } from '../parser/escpos/EscPosParser';
import { compileTo, parseFrom, previewFor, validateFor } from '../core/LanguageDispatch';
import type { PrinterLanguage } from '../core/PrinterLanguage';

// `.cut()` and `.table()` are the 2 newly-wired element types with real
// (non-no-op) compiler behavior — exercised here alongside the original
// `.text()`/`.barcode()` pair to prove they survive the same fluent chain
// and resolve/compile pipeline as the rest of the element set.
const doc = new LabelBuilder({ width: 40, height: 30, unit: 'mm', dpi: 203 })
  .text('Hello World', { x: 10, y: 10, size: 2 })
  .barcode({ symbology: 'code128', content: '123456789' })
  .table({
    x: 0,
    y: 80,
    columns: [
      { width: 10, align: 'left' },
      { width: 6, align: 'right' },
    ],
    rows: [['Coffee', '25000']],
  })
  .cut({ mode: 'full' })
  .resolve();

describe('Phase 1 end-to-end', () => {
  it('compiles, parses, and validates a document as TSC', () => {
    const tsc = new TscCompiler().compile(doc);
    expect(new TscValidator().validate(tsc).valid).toBe(true);
    expect(new TscParser().parse(tsc).commands.length).toBeGreaterThan(0);

    // `cut` compiles to a `SET CUTTER` command (mode 'full', rows defaulted to 1).
    const lines = tsc.trim().split('\r\n');
    expect(lines).toContain('SET CUTTER 1');

    // `table` compiles its rows into real TEXT commands carrying the cell content.
    expect(tsc).toContain('Coffee');
    expect(tsc).toContain('25000');
  });

  it('compiles and parses the same document as ESC/POS', () => {
    const bytes = new EscPosCompiler().compile(doc);
    expect(new EscPosParser().parse(bytes).commands.length).toBeGreaterThan(0);

    // `cut` compiles to a `GS V m` sequence (mode 'full', no explicit rows -> function A, m=0x00).
    expect(Array.from(bytes)).toEqual(expect.arrayContaining([0x1d, 0x56, 0x00]));

    // `table` compiles its rows into real text bytes carrying the cell content.
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Coffee');
    expect(text).toContain('25000');
  });
});

// All 9 `PrinterLanguage` values now have a real implementation (Phase 2
// complete). Two of them — "escpos" and "starprnt" — compile to raw
// `Uint8Array` (binary protocols); the rest compile to `string`. That split
// is an intentional, documented protocol difference (see `LanguageDispatch`'s
// own unit test, which likewise only runs `validateFor` on the string-source
// languages), not something this loop should paper over.
const ALL_LANGUAGES: readonly PrinterLanguage[] = ['tsc', 'escpos', 'zpl', 'epl', 'cpcl', 'dpl', 'sbpl', 'starprnt', 'ipl'];
const BINARY_LANGUAGES = new Set<PrinterLanguage>(['escpos', 'starprnt']);

describe('Phase 2 end-to-end: full 9-language coverage', () => {
  describe.each(ALL_LANGUAGES)('%s', (language) => {
    it('compiles, parses, validates, and previews the representative document', () => {
      const compiled = compileTo(language, doc);
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
