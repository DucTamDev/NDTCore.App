import { TsplCompiler } from '../TsplCompiler';
import { TSPL_COMMAND } from '../TsplCommand';
import type { ResolvedPrintDocument } from '../../../document';

describe('TsplCompiler', () => {
  it('emits a BITMAP command with an actual payload, not a bare trailing comma', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: {} }],
    }).output;
    expect(output).toContain('BITMAP');
    expect(output.trim().endsWith('BITMAP 0,0,2,1,0,')).toBe(false); // must not end with a bare trailing comma
  });

  it('appends the actual bitmap bytes after the BITMAP header, not just a longer string', () => {
    const compiler = new TsplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'image', bitmap, options: {} }],
    }).output;

    const headerIndex = output.indexOf('BITMAP 0,0,2,1,0,');
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const afterHeader = output.slice(headerIndex + 'BITMAP 0,0,2,1,0,'.length);
    expect(afterHeader.charCodeAt(0)).toBe(0xff);
    expect(afterHeader.charCodeAt(1)).toBe(0x00);
  });

  it('compiles a full label header followed by text, box, and PRINT commands', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [
        { type: 'text', content: 'Hello', options: { x: 10, y: 10 } },
        { type: 'box', options: { x: 0, y: 0, width: 100, height: 50, thickness: 2 } },
      ],
    }).output;

    const lines = output.trim().split('\r\n');
    expect(lines[0]).toBe('SIZE 40 mm,30 mm');
    expect(lines).toContain('CLS');
    expect(lines).toContain('TEXT 10,10,"2",0,1,1,"Hello"');
    expect(lines).toContain('BOX 0,0,100,50,2');
    expect(lines[lines.length - 1]).toBe('PRINT 1');
  });

  it('escapes a double-quote in TEXT content instead of letting it close the TSPL string early', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'text', content: 'Say "hello"', options: { x: 10, y: 10 } }],
    }).output;

    const lines = output.trim().split('\r\n');
    expect(lines).toContain('TEXT 10,10,"2",0,1,1,"Say \\"hello\\""');
    // An unescaped bare quote would split the command grammar into extra
    // comma-separated parameters instead of staying inside one string field.
    expect(output).not.toContain('"Say "hello""');
  });

  it('emits a DIAGONAL command for a diagonal element, not a BAR command', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'diagonal', options: { x1: 0, y1: 0, x2: 100, y2: 50, thickness: 2 } }],
    }).output;

    expect(output).toContain('DIAGONAL 0,0,100,50,2');
    expect(output).not.toContain('BAR ');
  });

  it('still emits a BAR command for an axis-aligned line element', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'line', options: { x1: 0, y1: 10, x2: 100, y2: 10, thickness: 2 } }],
    }).output;

    expect(output).toContain('BAR 0,10,100,2');
    expect(output).not.toContain('DIAGONAL');
  });

  it('emits SET CUTTER OFF for cut mode "off"', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'off' } }],
    }).output;

    const lines = output.trim().split('\r\n');
    expect(lines).toContain('SET CUTTER OFF');
  });

  it('emits SET CUTTER <rows> for cut mode "full" with an explicit rows count', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'full', rows: 3 } }],
    }).output;

    const lines = output.trim().split('\r\n');
    expect(lines).toContain('SET CUTTER 3');
  });

  it('defaults cut rows to 1 when omitted', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
      elements: [{ type: 'cut', options: { mode: 'partial' } }],
    }).output;

    const lines = output.trim().split('\r\n');
    expect(lines).toContain('SET CUTTER 1');
  });

  it('compiles a table element into real TEXT commands carrying its cell content', () => {
    const compiler = new TsplCompiler();
    const output = compiler.compile({
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
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
    }).output;

    expect(output).toContain(TSPL_COMMAND.TEXT);
    expect(output).toContain('hello');
    expect(output).toContain('world');
    expect(output).toContain('foo');
    expect(output).toContain('bar');

    // Two rows must land on two different y positions, not overwrite each other.
    const textLines = output.split('\r\n').filter((l) => l.startsWith(`${TSPL_COMMAND.TEXT} `));
    expect(textLines).toHaveLength(2);
    const yValues = textLines.map((l) => Number(l.split(',')[1]));
    expect(yValues[0]).toBe(20);
    expect(yValues[1]).toBeGreaterThan(20);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new TsplCompiler();
    expect(() =>
      compiler.compile({
        widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
        elements: [
          {
            type: 'table',
            options: {
              x: 5,
              y: 20,
              columns: [{ width: 10 }, { width: 0 }],
              rows: [['hello', 'world']],
            },
          },
        ],
      }).output,
    ).toThrow(/positive width/);
  });

  it('produces byte-identical output for pageBreak/spacer/row/column no-ops vs. an empty-elements document', () => {
    const compilerA = new TsplCompiler();
    const compilerB = new TsplCompiler();
    const baseDoc: Omit<ResolvedPrintDocument, 'elements'> = {
      widthDots: 320, heightDots: 240, dpi: 203, gapDots: 24, speed: 4, density: 8, direction: 'forward', copies: 1,
    };

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [
        { type: 'pageBreak' },
        { type: 'spacer', options: { size: 10 } },
        { type: 'row', options: {} },
        { type: 'column', options: {} },
      ],
    }).output;

    expect(noOpOutput).toBe(emptyOutput);
  });
});
