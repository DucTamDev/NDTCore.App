import { convert } from '../PrinterConverter';
import { SUPPORTED_SOURCES, SUPPORTED_TARGETS } from '../ConversionPath';
import { ConversionRegistry } from '../ConversionRegistry';
import { UnsupportedLanguageError } from '../../core/PrinterCoreError';
import type { PrinterLanguage } from '../../core/PrinterLanguage';

function bytesToBinaryString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

describe('convert', () => {
  it('converts a TSC label to recognizable ZPL syntax', () => {
    const tscSource = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,1,1,"Hello"\r\nPRINT 1\r\n';

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
