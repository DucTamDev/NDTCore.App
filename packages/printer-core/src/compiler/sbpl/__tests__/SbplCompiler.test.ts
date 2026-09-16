import { SbplCompiler } from '../SbplCompiler';
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

describe('SbplCompiler', () => {
  it('wraps the whole document with ESC A start, ESC CS clear, and a trailing ESC Z', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [] });

    expect(output).toContain('\x1bA');
    expect(output).toContain('\x1bCS');
    expect(output.trim().endsWith('\x1bZ')).toBe(true);
  });

  it('compiles a text element to H/V position, L magnification, and a K9B text field', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello SATO', options: { x: 100, y: 50, size: 2 } }] });

    expect(output).toContain('\x1bH0100');
    expect(output).toContain('\x1bV0050');
    expect(output).toContain('\x1bL0202');
    expect(output).toContain('\x1bK9BHello SATO');
  });

  it('defaults size to 1x1 magnification when omitted', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hi', options: { x: 0, y: 0 } }] });

    expect(output).toContain('\x1bL0101');
  });

  it('emits a rotation command only when rotation is set', () => {
    const compiler = new SbplCompiler();
    const rotated = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rotated', options: { x: 10, y: 20, rotation: 90 } }] });
    const notRotated = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Flat', options: { x: 10, y: 20 } }] });

    expect(rotated).toContain('\x1b%1');
    expect(notRotated).not.toContain('\x1b%');
  });

  it('maps each rotation to its ESC % suffix', () => {
    const compiler = new SbplCompiler();
    const r180 = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'X', options: { rotation: 180 } }] });
    const r270 = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'X', options: { rotation: 270 } }] });

    expect(r180).toContain('\x1b%2');
    expect(r270).toContain('\x1b%3');
  });

  it('emits an ESC GM command with the hex-encoded bitmap payload and its byte-count size prefix', () => {
    const compiler = new SbplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 8, height: 2, bytesPerRow: 1 };
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }] });

    expect(output).toContain('\x1bH0010');
    expect(output).toContain('\x1bV0010');
    expect(output).toContain('\x1bGM00002,FF00');
  });

  it('generates a box via H/V position plus an FW draw command', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 10, y: 20, width: 200, height: 100, thickness: 2 } }] });

    expect(output).toContain('\x1bH0010');
    expect(output).toContain('\x1bV0020');
    expect(output).toContain('\x1bFW02V0100H0200');
  });

  it('generates a horizontal line via FW...H', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });

    expect(output).toContain('\x1bFW02H0290');
  });

  it('generates a vertical line via FW...V', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 50, y1: 10, x2: 50, y2: 200, thickness: 1 } }] });

    expect(output).toContain('\x1bFW01V0190');
  });

  it('treats a diagonal element as a documented no-op, since SBPL FW draw has no diagonal capability', () => {
    const compilerA = new SbplCompiler();
    const compilerB = new SbplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const diagonalOutput = compilerB.compile({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(diagonalOutput).toBe(emptyOutput);
  });

  it('handles raw passthrough', () => {
    const compiler = new SbplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: '\x1bKC1' }] });

    expect(output).toContain('\x1bKC1');
  });

  it('emits ESC Q with the copy count when copies > 1, and omits it for a single copy', () => {
    const compiler = new SbplCompiler();
    const multi = compiler.compile({ ...baseDoc, copies: 3, elements: [] });
    const single = compiler.compile({ ...baseDoc, copies: 1, elements: [] });

    expect(multi).toContain('\x1bQ3');
    expect(single).not.toContain('\x1bQ');
  });

  it('compiles a table element into stacked K9B text fields carrying its cell content', () => {
    const compiler = new SbplCompiler();
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
    const textFields = output.split('\r\n').filter((l) => l.startsWith('\x1bK9B'));
    expect(textFields).toHaveLength(2);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new SbplCompiler();
    expect(() =>
      compiler.compile({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('produces identical output for circle/ellipse/reverse/erase/cut no-ops vs. an empty-elements document', () => {
    const compilerA = new SbplCompiler();
    const compilerB = new SbplCompiler();

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
    const compilerA = new SbplCompiler();
    const compilerB = new SbplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('produces identical output for barcode/qrcode no-ops vs. an empty-elements document, since SBPL has no documented grammar to derive a real command from', () => {
    const compilerA = new SbplCompiler();
    const compilerB = new SbplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [
        { type: 'barcode', options: { x: 0, y: 0, symbology: 'code128', content: '123' } },
        { type: 'qrcode', options: { x: 0, y: 0, content: 'hi' } },
      ],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });
});
