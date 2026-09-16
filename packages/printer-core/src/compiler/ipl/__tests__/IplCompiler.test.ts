import { IplCompiler } from '../IplCompiler';
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

describe('IplCompiler', () => {
  it('wraps the whole document with create-format/program-mode headers and a trailing print/end-format', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [] });

    expect(output).toContain('\x02\x1bC1\x03');
    expect(output).toContain('\x02\x1bP\x03');
    expect(output).toContain('\x02R\x03');
    expect(output).toContain('\x02\x1bE1\x03');
  });

  it('generates label size config from heightDots/widthDots', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, heightDots: 240, widthDots: 320, elements: [] });

    expect(output).toContain('<SI>L240');
    expect(output).toContain('<SI>W320');
  });

  it('generates speed and density config', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, speed: 6, density: 10, elements: [] });

    expect(output).toContain('<SI>S60');
    expect(output).toContain('<SI>d10');
  });

  it('generates multiple copies', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, copies: 5, elements: [] });

    expect(output).toContain('\x1bM5');
  });

  it('compiles a text element to an H field record carrying its position and content', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello IPL', options: { x: 50, y: 30 } }] });

    expect(output).toContain('H1;o50,30');
    expect(output).toContain('Hello IPL');
  });

  it('encodes rotation 90 as format code 1 in the H field', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Rotated', options: { x: 10, y: 20, rotation: 90 } }] });

    expect(output).toContain(';f1;');
  });

  it('generates a box field (W command) carrying its position, length, height and weight', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'box', options: { x: 10, y: 20, width: 200, height: 100, thickness: 2 } }],
    });

    expect(output).toContain('W1;o10,20');
    expect(output).toContain('l200');
    expect(output).toContain('h100');
    expect(output).toContain('w2');
  });

  it('generates a horizontal line field (L command)', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
    });

    expect(output).toContain('L1;o10,50');
    expect(output).toContain('l290');
  });

  it('generates a vertical line field with format code 1', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'line', options: { x1: 50, y1: 10, x2: 50, y2: 200 } }],
    });

    expect(output).toContain(';f1;');
    expect(output).toContain('l190');
  });

  it('handles raw passthrough', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'CUSTOM_CMD' }] });

    expect(output).toContain('CUSTOM_CMD');
  });

  it('compiles a table element into stacked H field records carrying its cell content, one field number per row', () => {
    const compiler = new IplCompiler();
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
    expect(output).toContain('H1;');
    expect(output).toContain('H2;');
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new IplCompiler();
    expect(() =>
      compiler.compile({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }),
    ).toThrow(/positive width/);
  });

  it('produces identical output for diagonal/circle/ellipse/reverse/erase/cut no-ops vs. an empty-elements document', () => {
    const compilerA = new IplCompiler();
    const compilerB = new IplCompiler();

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

  // barcode/qrcode have no verified IPL field grammar to port or derive
  // (portakal's own IPL parser only recognizes a `B`-prefixed field as an
  // opaque command, never decoding symbology/module parameters) —
  // documented no-ops, same treatment as circle/ellipse/reverse/erase above,
  // not real output.
  it('produces identical output for barcode/qrcode no-ops vs. an empty-elements document', () => {
    const compilerA = new IplCompiler();
    const compilerB = new IplCompiler();

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
    const compilerA = new IplCompiler();
    const compilerB = new IplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  // The core bug fix this task requires (Step 3): portakal's IPL image case
  // emits ONLY `{STX}G{fieldNum};o{x},{y};f0{ETX}` — no width, no height, no
  // data. These two tests prove real, byte-accurate payload data now
  // follows the header. See `IplEncoder.ts`'s doc comment for this task's
  // full confidence disclosure on the exact clause syntax (LOW confidence,
  // flagged for hardware verification) — these tests assert only what is
  // certain: header shape plus real trailing bytes.
  it('emits a graphic (G) field record with an actual payload, not a bare header', () => {
    const compiler = new IplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: { x: 5, y: 6 } }],
    });

    const header = '\x02G1;o5,6;f0;w2;h1;';
    const headerIndex = output.indexOf(header);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const afterHeader = output.slice(headerIndex + header.length, headerIndex + header.length + 2);
    expect(afterHeader.charCodeAt(0)).toBe(0xff);
    expect(afterHeader.charCodeAt(1)).toBe(0x00);
  });

  it('appends exactly bytesPerRow * height payload bytes after the graphic field header, matching bitmap.data byte for byte', () => {
    const compiler = new IplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 1, y: 2 } }] });

    const header = '\x02G1;o1,2;f0;w3;h1;';
    const headerIndex = output.indexOf(header);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const payload = output.slice(headerIndex + header.length, headerIndex + header.length + 3);
    expect(payload.charCodeAt(0)).toBe(0xff);
    expect(payload.charCodeAt(1)).toBe(0x00);
    expect(payload.charCodeAt(2)).toBe(0xa5);
    // The header is immediately followed by an ETX right after the payload,
    // confirming no stray bytes leak between payload and frame close.
    expect(output.slice(headerIndex + header.length + 3, headerIndex + header.length + 4)).toBe('\x03');
  });
});
