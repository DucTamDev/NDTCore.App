import { CpclCompiler } from '../CpclCompiler';
import type { ResolvedPrintDocument } from '../../../document';

const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
  widthDots: 320,
  heightDots: 240,
  dpi: 203,
  gapDots: 24,
  speed: 4,
  density: 8,
  direction: 'forward',
  copies: 1,
};

describe('CpclCompiler', () => {
  it('compiles a text element to a TEXT command with its position and content on the following line', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello CPCL', options: { x: 10, y: 20, font: '5', size: 1 } }] });

    expect(output).toContain('TEXT 5 1 10 20\r\nHello CPCL');
  });

  it('appends the rotation to the TEXT command name when rotated', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rot', options: { x: 5, y: 5, rotation: 90 } }] });

    expect(output).toContain('TEXT90 2 0 5 5\r\nRot');
  });

  it('wraps the whole document with !/TONE/SPEED/PAGE-WIDTH header commands and a trailing PRINT', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [] });

    const lines = output.trim().split('\r\n');
    expect(lines[0]).toBe('! 0 203 203 240 1');
    expect(lines).toContain('TONE 107'); // round((8/15)*200)
    expect(lines).toContain('SPEED 4');
    expect(lines).toContain('PAGE-WIDTH 320');
    expect(lines[lines.length - 1]).toBe('PRINT');
  });

  it('emits an EG command with the hex-encoded bitmap payload', () => {
    const compiler = new CpclCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }] });

    expect(output).toContain('EG 3 1 10 10 FF00A5');
  });

  it('generates a box command', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 5, y: 5, width: 200, height: 100, thickness: 2 } }] });

    expect(output).toContain('BOX 5 5 205 105 2');
  });

  it('generates a LINE command for an axis-aligned line', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });

    expect(output).toContain('LINE 10 50 300 50 2');
  });

  it('generates the same LINE command shape for a genuinely diagonal line, since CPCL LINE draws between any two points', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(output).toContain('LINE 0 0 100 50 2');
  });

  it('compiles a table element into stacked TEXT commands carrying its cell content', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [
        {
          type: 'table',
          options: {
            x: 5,
            y: 20,
            columns: [{ width: 10 }, { width: 10 }],
            rows: [
              ['hello', 'world'],
              ['foo', 'bar'],
            ],
          },
        },
      ],
    });

    expect(output).toContain('hello');
    expect(output).toContain('world');
    expect(output).toContain('foo');
    expect(output).toContain('bar');

    const textLines = output.split('\r\n').filter((l) => l.startsWith('TEXT 2 0 5 '));
    expect(textLines).toHaveLength(2);
    const yValues = textLines.map((l) => Number(l.split(' ')[4]));
    expect(yValues[0]).toBe(20);
    expect(yValues[1]).toBeGreaterThan(20);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new CpclCompiler();
    expect(() =>
      compiler.compile({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('handles multiple copies', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, copies: 10, elements: [] });

    expect(output.trim().split('\r\n')[0]).toBe('! 0 203 203 240 10');
  });

  it('handles raw passthrough', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: '! U1 setvar "device.friendly_name" "test"' }] });

    expect(output).toContain('! U1 setvar "device.friendly_name" "test"');
  });

  it('produces identical output for circle/ellipse/reverse/erase/cut no-ops vs. an empty-elements document', () => {
    const compilerA = new CpclCompiler();
    const compilerB = new CpclCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [
        { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
        { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'cut', options: { mode: 'full' } },
      ],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('produces identical output for pageBreak/spacer/row/column no-ops vs. an empty-elements document', () => {
    const compilerA = new CpclCompiler();
    const compilerB = new CpclCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('compiles a barcode element into a BARCODE command carrying its content', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } }],
    });

    expect(output).toContain('BARCODE 128 2 2 50 5 5 123456789');
  });

  it('compiles a qrcode element into a B QR block carrying its content', () => {
    const compiler = new CpclCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } }],
    });

    expect(output).toContain('B QR10,10\r\nM2\r\nU6\r\nMA,hello\r\nENDQR');
  });
});
