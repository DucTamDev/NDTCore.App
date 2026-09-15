import { ZplCompiler } from '../ZplCompiler';
import { ZplParser } from '../../../parser/zpl/ZplParser';
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

describe('ZplCompiler', () => {
  it('compiles a text element to ^FO/^FD carrying its position and content', () => {
    const compiler = new ZplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'text', content: 'Hello', options: { x: 10, y: 20 } }] });

    expect(output).toContain('^FO10,20');
    expect(output).toContain('^FDHello^FS');
  });

  it('wraps the whole document in ^XA...^XZ with ^PW/^LL/^PQ set from the document', () => {
    const compiler = new ZplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [] });

    expect(output.startsWith('^XA')).toBe(true);
    expect(output).toContain('^PW320');
    expect(output).toContain('^LL240');
    expect(output).toContain('^PQ1');
    expect(output.trim().endsWith('^XZ')).toBe(true);
  });

  it('round-trips a barcode element through ZplParser into a recognizable ^B command and field data', () => {
    const compiler = new ZplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } }],
    });

    const parsed = new ZplParser().parse(output);
    expect(parsed.warnings).toEqual([]);

    const commands = parsed.commands as Array<{ code: string; rawParams: string }>;
    expect(commands.some((c) => c.code === '^BC')).toBe(true);
    expect(commands.some((c) => c.code === '^FD' && c.rawParams === '123456789')).toBe(true);
  });

  it('compiles a table element into text fields carrying its cell content', () => {
    const compiler = new ZplCompiler();
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

    const fieldOrigins = output.match(/\^FO\d+,\d+/g) ?? [];
    expect(fieldOrigins).toHaveLength(2);
    expect(fieldOrigins[0]).toBe('^FO5,20');
    const secondY = Number(fieldOrigins[1].split(',')[1]);
    expect(secondY).toBeGreaterThan(20);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new ZplCompiler();
    expect(() =>
      compiler.compile({
        ...baseDoc,
        elements: [
          {
            type: 'table',
            options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] },
          },
        ],
      }),
    ).toThrow(/positive width/);
  });

  it('produces identical output for ellipse/reverse/erase no-ops vs. an empty-elements document', () => {
    const compilerA = new ZplCompiler();
    const compilerB = new ZplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [
        { type: 'ellipse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 10, height: 10 } },
        { type: 'erase', options: { x: 0, y: 0, width: 10, height: 10 } },
      ],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('produces identical output for pageBreak/spacer/row/column no-ops vs. an empty-elements document', () => {
    const compilerA = new ZplCompiler();
    const compilerB = new ZplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] });
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
    });

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('emits ^MMC for cut mode "full" and ^MMT for cut mode "off"', () => {
    const on = new ZplCompiler().compile({ ...baseDoc, elements: [{ type: 'cut', options: { mode: 'full' } }] });
    const off = new ZplCompiler().compile({ ...baseDoc, elements: [{ type: 'cut', options: { mode: 'off' } }] });

    expect(on).toContain('^MMC');
    expect(off).toContain('^MMT');
  });

  it('emits a DIAGONAL-style ^GD command for a diagonal element, not a ^GB box', () => {
    const compiler = new ZplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }] });

    expect(output).toContain('^GD100,50,2,B,R');
  });

  it('appends the actual bitmap bytes as uppercase hex after the ^GFA header', () => {
    const compiler = new ZplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'image', bitmap, options: { x: 0, y: 0 } }] });

    expect(output).toContain('^GFA,2,2,2,FF00');
  });
});
