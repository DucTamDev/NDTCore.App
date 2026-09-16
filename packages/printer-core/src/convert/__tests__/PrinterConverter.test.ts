import { convert } from '../PrinterConverter';
import { SUPPORTED_SOURCES, SUPPORTED_TARGETS } from '../ConversionPath';
import { ConversionRegistry } from '../ConversionRegistry';
import { UnsupportedLanguageError } from '../../core/PrinterCoreError';
import type { PrinterLanguage } from '../../core/PrinterLanguage';

function bytesToBinaryString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

/** One 50x30mm label carrying a single text field — the shared input for every "TSC to X" case below. */
const TSC_SOURCE = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,1,1,"Hello"\r\nPRINT 1\r\n';

describe('convert', () => {
  it('converts a TSC label to recognizable ZPL syntax', () => {
    const tscSource = TSC_SOURCE;

    const result = convert(tscSource, 'tsc', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FDHello^FS');
    expect(result.output).toContain('^XZ');
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { x: 10, y: 10, font: '3', rotation: 0, size: 1 } }]);
    expect(result.warnings).toEqual([]);
  });

  it('converts an ESC/POS byte stream to recognizable TSC syntax', () => {
    // ESC @ (init) + "Hello" (printable ASCII) + LF
    const escposSource = bytesToBinaryString([0x1b, 0x40, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]);

    const result = convert(escposSource, 'escpos', 'tsc');

    expect(result.output).toContain('SIZE');
    expect(result.output).toContain('CLS');
    expect(result.output).toContain('TEXT');
    expect(result.output).toContain('"Hello"');
    expect(result.output).toContain('PRINT');
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello', options: { align: 'left', bold: undefined, underline: undefined, size: 1 } }]);
  });

  it('converts an EPL label to recognizable ZPL syntax', () => {
    const eplSource = ['N', 'q320', 'Q240,24', 'A10,20,0,2,1,1,N,"Hello EPL"'].join('\n');

    const result = convert(eplSource, 'epl', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FDHello EPL^FS');
    expect(result.output).toContain('^XZ');
    expect(result.elements).toEqual([
      { type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, rotation: 0, font: '2', size: 1, reverse: undefined } },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('converts a TSC label to recognizable EPL syntax', () => {
    const result = convert(TSC_SOURCE, 'tsc', 'epl');

    expect(result.output).toContain('A10,10,0,3,1,1,N,"Hello"');
    expect(result.output).toContain('q400');
    expect(result.warnings).toEqual([]);
  });

  it('converts a CPCL label to recognizable ZPL syntax', () => {
    const cpclSource = ['! 0 203 203 240 1', 'PAGE-WIDTH 320', 'TEXT 2 0 10 20', 'Hello CPCL', 'PRINT'].join('\r\n');

    const result = convert(cpclSource, 'cpcl', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FDHello CPCL^FS');
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, font: '2', size: 0 } }]);
    expect(result.warnings).toEqual([]);
  });

  it('converts a TSC label to recognizable CPCL syntax', () => {
    const result = convert(TSC_SOURCE, 'tsc', 'cpcl');

    expect(result.output).toContain('TEXT 3 1 10 10\r\nHello');
    expect(result.output).toContain('PAGE-WIDTH 400');
    expect(result.output).toContain('PRINT');
  });

  it('converts a DPL label to recognizable ZPL syntax', () => {
    // DplParser recovers content with a fixed 20-char offset guess, which is
    // one short for a single-digit font — hence the leading "9" surviving
    // into the converted text. Asserted as-is: the conversion path must not
    // quietly differ from what the parser actually produces.
    const record = '1' + '0010' + '0020' + '0001' + '0001' + '0009' + 'Hello';
    const dplSource = ['\x02L', 'A0320', record, 'E'].join('\r\n');

    const result = convert(dplSource, 'dpl', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FD9Hello^FS');
    expect(result.elements).toEqual([{ type: 'text', content: '9Hello', options: { x: 10, y: 20 } }]);
  });

  it('converts a TSC label to recognizable DPL syntax', () => {
    const result = convert(TSC_SOURCE, 'tsc', 'dpl');

    expect(result.output).toContain('\x02L');
    expect(result.output).toContain('Hello');
    expect(result.output).toContain('A0400');
  });

  it('converts an SBPL label to recognizable ZPL syntax', () => {
    const sbplSource = '\x1bA\x1bCS\x1bH0100\x1bV0050\x1bL0202\x1bK9BHello SATO\x1bZ';

    const result = convert(sbplSource, 'sbpl', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FDHello SATO^FS');
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50 } }]);
    expect(result.warnings).toEqual([]);
  });

  it('converts a TSC label to recognizable SBPL syntax', () => {
    const result = convert(TSC_SOURCE, 'tsc', 'sbpl');

    expect(result.output).toContain('\x1bA');
    expect(result.output).toContain('\x1bH0010');
    expect(result.output).toContain('\x1bV0010');
    expect(result.output).toContain('\x1bK9BHello');
    expect(result.output).toContain('\x1bZ');
  });

  it('converts an IPL label to recognizable ZPL syntax', () => {
    const iplSource = ['\x02<SI>W320\x03', '\x02<SI>L240\x03', '\x02H1;o50,30;f0;h12;w12;c26;d3,Hello IPL\x03'].join('');

    const result = convert(iplSource, 'ipl', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FDHello IPL^FS');
    expect(result.elements).toContainEqual({ type: 'text', content: 'Hello IPL', options: { x: 50, y: 30 } });
    expect(result.warnings).toEqual([]);
  });

  it('converts a TSC label to recognizable IPL syntax', () => {
    const result = convert(TSC_SOURCE, 'tsc', 'ipl');

    expect(result.output).toContain('\x02\x1bC1\x03');
    expect(result.output).toContain('H1;o10,10');
    expect(result.output).toContain('Hello');
    expect(result.output).toContain('\x02R\x03');
  });

  it('converts a Star PRNT byte stream to recognizable ZPL syntax', () => {
    // ESC @ (init) + "Hello Star" + LF
    const starSource = bytesToBinaryString([0x1b, 0x40, ...Array.from(new TextEncoder().encode('Hello Star')), 0x0a]);

    const result = convert(starSource, 'starprnt', 'zpl');

    expect(result.output).toContain('^XA');
    expect(result.output).toContain('^FDHello Star^FS');
    expect(result.elements).toEqual([{ type: 'text', content: 'Hello Star', options: { align: 'left', bold: undefined } }]);
    expect(result.warnings).toEqual([]);
  });

  it('converts a TSC label to a Star PRNT byte stream, returned as a one-char-per-byte binary string', () => {
    const result = convert(TSC_SOURCE, 'tsc', 'starprnt');

    // ESC @ (initialize) leads every Star PRNT document this package emits.
    expect(result.output.slice(0, 2)).toBe('\x1b\x40');
    expect(result.output).toContain('Hello');
    // ESC GS a n (alignment) is Star-specific and proves this isn't ESC/POS output.
    expect(result.output).toContain('\x1b\x1da');
  });

  it('throws a clear error for an unregistered source language', () => {
    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'zpl')).toThrow(UnsupportedLanguageError);
    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'zpl')).toThrow(/made-up/);
  });

  it('throws a clear error for an unregistered target language', () => {
    expect(() => convert('SIZE 50 mm,30 mm\r\nCLS\r\nPRINT 1\r\n', 'tsc', 'made-up' as PrinterLanguage)).toThrow(UnsupportedLanguageError);
  });

  it('derives SUPPORTED_SOURCES/SUPPORTED_TARGETS from ConversionRegistry, covering all 9 languages', () => {
    const registryKeys = Object.keys(ConversionRegistry).sort();
    expect(registryKeys).toHaveLength(9);
    expect([...SUPPORTED_SOURCES].sort()).toEqual(registryKeys);
    expect([...SUPPORTED_TARGETS].sort()).toEqual(registryKeys);
  });
});
