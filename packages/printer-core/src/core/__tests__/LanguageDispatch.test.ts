import { compileTo, parseFrom, validateFor, previewFor } from '../LanguageDispatch';
import { UnsupportedLanguageError } from '../PrinterCoreError';
import type { ResolvedPrintDocument } from '../../document';

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
  it('routes "tsc" to TscCompiler/TscParser/TscValidator/TscPreviewRenderer', () => {
    const tsc = compileTo('tsc', doc);
    expect(typeof tsc).toBe('string');
    expect(parseFrom('tsc', tsc as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('tsc', tsc as string).valid).toBe(true);
    expect(previewFor('tsc', doc)).toContain('<svg');
  });

  it('routes "escpos" to EscPosCompiler/EscPosParser/EscPosValidator/EscPosPreviewRenderer', () => {
    const bytes = compileTo('escpos', doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(parseFrom('escpos', bytes as Uint8Array).commands.length).toBeGreaterThan(0);
    expect(previewFor('escpos', doc)).toContain('<svg');
  });

  it('routes "zpl" to ZplCompiler/ZplParser/ZplValidator/ZplPreviewRenderer', () => {
    const zpl = compileTo('zpl', doc);
    expect(typeof zpl).toBe('string');
    expect(parseFrom('zpl', zpl as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('zpl', zpl as string).valid).toBe(true);
    expect(previewFor('zpl', doc)).toContain('<svg');
  });

  it('routes "epl" to EplCompiler/EplParser/EplValidator/EplPreviewRenderer', () => {
    const epl = compileTo('epl', doc);
    expect(typeof epl).toBe('string');
    expect(parseFrom('epl', epl as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('epl', epl as string).valid).toBe(true);
    expect(previewFor('epl', doc)).toContain('<svg');
  });

  it('routes "cpcl" to CpclCompiler/CpclParser/CpclValidator/CpclPreviewRenderer', () => {
    const cpcl = compileTo('cpcl', doc);
    expect(typeof cpcl).toBe('string');
    expect(parseFrom('cpcl', cpcl as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('cpcl', cpcl as string).valid).toBe(true);
    expect(previewFor('cpcl', doc)).toContain('<svg');
  });

  it('routes "dpl" to DplCompiler/DplParser/DplValidator/DplPreviewRenderer', () => {
    const dpl = compileTo('dpl', doc);
    expect(typeof dpl).toBe('string');
    expect(parseFrom('dpl', dpl as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('dpl', dpl as string).valid).toBe(true);
    expect(previewFor('dpl', doc)).toContain('<svg');
  });

  it('routes "sbpl" to SbplCompiler/SbplParser/SbplValidator/SbplPreviewRenderer', () => {
    const sbpl = compileTo('sbpl', doc);
    expect(typeof sbpl).toBe('string');
    expect(parseFrom('sbpl', sbpl as string).commands.length).toBeGreaterThan(0);
    expect(validateFor('sbpl', sbpl as string).valid).toBe(true);
    expect(previewFor('sbpl', doc)).toContain('<svg');
  });

  it('throws a clear UnsupportedLanguageError for the 2 not-yet-implemented languages', () => {
    for (const language of ['starprnt', 'ipl'] as const) {
      expect(() => compileTo(language, doc)).toThrow(UnsupportedLanguageError);
      expect(() => parseFrom(language, '')).toThrow(UnsupportedLanguageError);
      expect(() => validateFor(language, '')).toThrow(UnsupportedLanguageError);
      expect(() => previewFor(language, doc)).toThrow(UnsupportedLanguageError);
    }
  });
});
