import { DplCompiler } from '../DplCompiler';
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

describe('DplCompiler', () => {
  it('wraps the whole document with an STX L header, D/S/A setup commands, a trailing Q and E', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [] });

    expect(output).toContain('\x02L');
    expect(output).toContain('D08');
    expect(output).toContain('S04');
    expect(output).toContain('A0320');
    expect(output).toContain('Q0001');
    expect(output.trimEnd().endsWith('E')).toBe(true);
  });

  it('handles multiple copies', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, copies: 5, elements: [] });

    expect(output).toContain('Q0005');
  });

  it('compiles a text element to a fixed-field record carrying its position and content', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello DPL', options: { x: 10, y: 20 } }] });

    expect(output).toContain('0010');
    expect(output).toContain('0020');
    expect(output).toContain('Hello DPL');
  });

  it('encodes rotation 90 as record rotation code 2', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rot', options: { x: 10, y: 20, rotation: 90 } }] });

    const lines = output.split('\r\n').filter((l) => l.includes('Rot'));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('2')).toBe(true);
  });

  it('generates a box record carrying its position and dimensions', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'box', options: { x: 5, y: 5, width: 100, height: 80, thickness: 2 } }] });

    expect(output).toContain('0005');
    expect(output).toContain('0100');
    expect(output).toContain('0080');
  });

  it('generates a horizontal line record', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }] });

    expect(output).toContain('0010');
    expect(output).toContain('0050');
    expect(output).toContain('0290');
  });

  it('generates a vertical line record', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'line', options: { x1: 10, y1: 10, x2: 10, y2: 90, thickness: 2 } }] });

    expect(output).toContain('0010');
    expect(output).toContain('0080');
  });

  it('emits an image record with an actual payload, not a bare header', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: { x: 0, y: 0 } }],
    });

    // Header: rotation('1') + col(0000) + row(0000) + h(0001, =height) + w(0002, =bytesPerRow) + fixed('0005').
    // Portakal's buggy version emits exactly this and nothing more — proving
    // there are bytes appended right after it proves the bug is fixed.
    const header = '1' + '0000' + '0000' + '0001' + '0002' + '0005';
    const headerIndex = output.indexOf(header);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const afterHeader = output.slice(headerIndex + header.length, headerIndex + header.length + 2);
    expect(afterHeader.charCodeAt(0)).toBe(0xff);
    expect(afterHeader.charCodeAt(1)).toBe(0x00);
  });

  it('appends exactly bytesPerRow * height payload bytes after the image header, matching bitmap.data byte for byte', () => {
    const compiler = new DplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 1, y: 2 } }] });

    const header = '1000100020001' + '0003' + '0005';
    const headerIndex = output.indexOf(header);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const payload = output.slice(headerIndex + header.length, headerIndex + header.length + 3);
    expect(payload.charCodeAt(0)).toBe(0xff);
    expect(payload.charCodeAt(1)).toBe(0x00);
    expect(payload.charCodeAt(2)).toBe(0xa5);
  });

  it('compiles a table element into stacked fixed-field text records carrying its cell content', () => {
    const compiler = new DplCompiler();
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
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new DplCompiler();
    expect(() =>
      compiler.compile({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('handles raw passthrough', () => {
    const compiler = new DplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'CUSTOM' }] });

    expect(output).toContain('CUSTOM');
  });

  it('produces identical output for diagonal/circle/ellipse/reverse/erase/cut no-ops vs. an empty-elements document', () => {
    const compilerA = new DplCompiler();
    const compilerB = new DplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [
        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } },
        { type: 'circle', options: { x: 0, y: 0, diameter: 10 } },
        { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'cut', options: { mode: 'full' } },
      ],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  // barcode/qrcode have no verified DPL record grammar to port or derive
  // (unlike EPL2/CPCL, whose barcode commands are corroborated by
  // well-documented, externally verifiable manuals) — documented no-ops,
  // same treatment as circle/ellipse/reverse/erase above, not real output.
  it('produces identical output for barcode/qrcode no-ops vs. an empty-elements document', () => {
    const compilerA = new DplCompiler();
    const compilerB = new DplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [
        { type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } },
        { type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } },
      ],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('produces identical output for pageBreak/spacer/row/column no-ops vs. an empty-elements document', () => {
    const compilerA = new DplCompiler();
    const compilerB = new DplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });
});
