import { convert } from '../PrinterConverter';
import { UnsupportedLanguageError } from '../../core/UnsupportedLanguageError';
import type { PrinterLanguage } from '../../core/PrinterLanguage';

function bytesToBinaryString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

/** One 50x30mm label carrying a single text field — the shared input for every "TSPL to X" case below. */
const TSPL_SOURCE = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,1,1,"Hello"\r\nPRINT 1\r\n';

describe('convert', () => {
  it('converts an ESC/POS byte stream to recognizable TSPL syntax', () => {
    // ESC @ (init) + "Hello" (printable ASCII) + LF
    const escposSource = bytesToBinaryString([0x1b, 0x40, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]);

    const result = convert(escposSource, 'escpos', 'tspl');

    expect(result.output).toContain('SIZE');
    expect(result.output).toContain('CLS');
    expect(result.output).toContain('TEXT');
    expect(result.output).toContain('"Hello"');
    expect(result.output).toContain('PRINT');
    expect(result.elements).toEqual([
      {
        type: 'text',
        content: 'Hello',
        options: { align: 'left', bold: undefined, underline: undefined, fontSize: 24 },
      },
    ]);
  });

  it('converts a TSPL label to an ESC/POS byte stream, returned as a one-char-per-byte binary string', () => {
    const result = convert(TSPL_SOURCE, 'tspl', 'escpos');

    // ESC @ (initialize) leads every ESC/POS document this package emits.
    expect(result.output.slice(0, 2)).toBe('\x1b\x40');
    expect(result.output).toContain('Hello');
  });

  it('throws a clear error for an unregistered source language', () => {
    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'tspl')).toThrow(UnsupportedLanguageError);
    expect(() => convert('irrelevant', 'made-up' as PrinterLanguage, 'tspl')).toThrow(/made-up/);
  });

  it('throws a clear error for an unregistered target language', () => {
    expect(() => convert('SIZE 50 mm,30 mm\r\nCLS\r\nPRINT 1\r\n', 'tspl', 'made-up' as PrinterLanguage)).toThrow(UnsupportedLanguageError);
  });
});

describe('convert — cảnh báo', () => {
  it('gộp cảnh báo compile của ngôn ngữ đích vào kết quả', () => {
    const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nCIRCLE 10,10,50,2\r\nPRINT 1\r\n';

    expect(convert(source, 'tspl', 'escpos').warnings).toEqual([
      'Element "circle" bị bỏ qua — ESC/POS không có lệnh tương ứng.',
    ]);
  });

  it('TSPL → TSPL giữ nguyên chiều cao chữ in ra dù mã font có thể đổi', () => {
    const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"3",0,2,2,"Big"\r\nPRINT 1\r\n';

    const firstPass = convert(source, 'tspl', 'tspl');
    const secondPass = convert(firstPass.output as string, 'tspl', 'tspl');

    expect(firstPass.elements[0]).toMatchObject({ options: { fontSize: 48 } });
    expect(secondPass.elements[0]).toMatchObject({ options: { fontSize: 48 } });
  });

  it('TSPL → TSPL đọc font "0" (scalable) theo point size, compile lại chọn font bitmap gần nhất', () => {
    const source = 'SIZE 50 mm,30 mm\r\nCLS\r\nTEXT 10,10,"0",0,12,12,"Scalable"\r\nPRINT 1\r\n';

    const firstPass = convert(source, 'tspl', 'tspl');

    expect(firstPass.elements[0]).toMatchObject({ options: { fontSize: expect.closeTo(12 * (203 / 72)) } });

    const secondPass = convert(firstPass.output as string, 'tspl', 'tspl');

    expect(secondPass.elements[0]).toMatchObject({ options: { fontSize: expect.closeTo(32) } });
  });
});
