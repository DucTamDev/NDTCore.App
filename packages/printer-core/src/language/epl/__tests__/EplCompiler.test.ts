import { EplCompiler } from '../EplCompiler';
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

describe('EplCompiler', () => {
  it('compiles a text element to an A command carrying its position and content', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'text', content: 'Hello EPL', options: { x: 10, y: 20, fontSize: 40 } }],
    }).output;

    expect(output).toContain('A10,20,0,3,2,2,N,"Hello EPL"');
  });

  it('generates reverse text with the R flag', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'text', content: 'Reverse', options: { x: 10, y: 20, reverse: true } }],
    }).output;

    expect(output).toContain('A10,20,0,2,1,1,R,"Reverse"');
  });

  it('wraps the whole document with N/q/Q/S/D header commands and a trailing P', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [] }).output;

    const lines = output.trim().split('\n');
    expect(lines[0]).toBe('N');
    expect(lines).toContain('q320');
    expect(lines).toContain('Q240,24');
    expect(lines).toContain('S4');
    expect(lines).toContain('D8');
    expect(lines[lines.length - 1]).toBe('P1');
  });

  it('emits a GW command with an actual payload, not a bare header', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'image', bitmap: { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 }, options: {} }],
    }).output;

    expect(output).toContain('GW');
    expect(output.trim().split('\n').some((line) => line === 'GW0,0,2,1,')).toBe(false); // must not end at a bare trailing comma
  });

  it('appends the actual bitmap bytes after the GW header, not just a longer string', () => {
    const compiler = new EplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00]), width: 16, height: 1, bytesPerRow: 2 };
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'image', bitmap, options: { x: 10, y: 10 } }],
    }).output;

    const headerIndex = output.indexOf('GW10,10,2,1,');
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const afterHeader = output.slice(headerIndex + 'GW10,10,2,1,'.length);
    // GW's polarity is inverted relative to bitmap.data (see EplEncoder.ts) —
    // 0xff in bitmap.data comes out as 0x00 in the payload, and vice versa;
    // the inversion itself is asserted precisely in the dedicated test below.
    expect(afterHeader.charCodeAt(0)).toBe(0x00);
    expect(afterHeader.charCodeAt(1)).toBe(0xff);
  });

  it('inverts each payload byte relative to bitmap.data, per GW\'s documented inverted polarity (0=black, 1=white)', () => {
    const compiler = new EplCompiler();
    const bitmap = { data: new Uint8Array([0xff, 0x00, 0xa5]), width: 24, height: 1, bytesPerRow: 3 };
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'image', bitmap, options: { x: 0, y: 0 } }],
    }).output;

    const header = 'GW0,0,3,1,';
    const headerIndex = output.indexOf(header);
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    const payload = output.slice(headerIndex + header.length, headerIndex + header.length + 3);

    expect(payload.charCodeAt(0)).toBe(0x00); // 0xff -> 0x00
    expect(payload.charCodeAt(1)).toBe(0xff); // 0x00 -> 0xff
    expect(payload.charCodeAt(2)).toBe(0x5a); // 0xa5 -> 0x5a (bitwise complement)
  });

  it('generates a box command', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'box', options: { x: 5, y: 5, width: 200, height: 100, thickness: 2 } }],
    }).output;

    expect(output).toContain('X5,5,205,105,2');
  });

  it('generates a horizontal line via LO', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'line', options: { x1: 10, y1: 50, x2: 300, y2: 50, thickness: 2 } }],
    }).output;

    expect(output).toContain('LO10,50,290,2');
  });

  it('compiles a table element into stacked A commands carrying its cell content', () => {
    const compiler = new EplCompiler();
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
    }).output;

    expect(output).toContain('hello');
    expect(output).toContain('world');
    expect(output).toContain('foo');
    expect(output).toContain('bar');

    const textLines = output.split('\n').filter((l) => l.startsWith('A5,'));
    expect(textLines).toHaveLength(2);
    const yValues = textLines.map((l) => Number(l.split(',')[1]));
    expect(yValues[0]).toBe(20);
    expect(yValues[1]).toBeGreaterThan(20);
  });

  it('throws a clear error when a table column has a non-positive width instead of silently dropping its content', () => {
    const compiler = new EplCompiler();
    expect(() =>
      compiler.compile({
        ...baseDoc,
        elements: [{ type: 'table', options: { x: 5, y: 20, columns: [{ width: 10 }, { width: 0 }], rows: [['hello', 'world']] } }],
      }).output,
    ).toThrow(/positive width/);
  });

  it('handles multiple copies', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({ ...baseDoc, copies: 10, elements: [] }).output;

    expect(output.trim().endsWith('P10')).toBe(true);
  });

  it('handles raw passthrough', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({ ...baseDoc, elements: [{ type: 'raw', content: 'OD' }] }).output;

    expect(output).toContain('OD');
  });

  it('cảnh báo và bỏ qua raw content dạng bytes', () => {
    const compiler = new EplCompiler();
    const bytesElement = { type: 'raw' as const, content: new Uint8Array([1, 2, 3]) };
    const withBytes = compiler.compile({ ...baseDoc, elements: [bytesElement] });
    const empty = compiler.compile({ ...baseDoc, elements: [] });

    expect(withBytes.output).toBe(empty.output);
    expect(withBytes.warnings).toEqual(['RawElement dạng bytes bị bỏ qua — EPL chỉ nhận lệnh dạng chuỗi.']);
  });

  it('produces identical output for diagonal/circle/ellipse/reverse/erase/cut no-ops vs. an empty-elements document', () => {
    const compilerA = new EplCompiler();
    const compilerB = new EplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
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
    }).output;

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('produces identical output for pageBreak/spacer/row/column no-ops vs. an empty-elements document', () => {
    const compilerA = new EplCompiler();
    const compilerB = new EplCompiler();

    const emptyOutput = compilerA.compile({ ...baseDoc, elements: [] }).output;
    const noOpOutput = compilerB.compile({
      ...baseDoc,
      elements: [{ type: 'pageBreak' }, { type: 'spacer', options: { size: 10 } }, { type: 'row', options: {} }, { type: 'column', options: {} }],
    }).output;

    expect(noOpOutput).toBe(emptyOutput);
  });

  it('compiles a barcode element into a B command carrying its content', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'barcode', options: { x: 5, y: 5, symbology: 'code128', content: '123456789' } }],
    }).output;

    expect(output).toContain('B5,5,0,3,2,2,50,B,"123456789"');
  });

  it('compiles a qrcode element into a b command carrying its content', () => {
    const compiler = new EplCompiler();
    const output = compiler.compile({
      ...baseDoc,
      elements: [{ type: 'qrcode', options: { x: 10, y: 10, content: 'hello' } }],
    }).output;

    expect(output).toContain('b10,10,0,"QR",4,M,"hello"');
  });
});

describe('EplCompiler — cỡ chữ và cảnh báo', () => {
  it('không khai báo fontSize thì dùng font 2 ở hệ số 1', () => {
    const { output } = new EplCompiler().compile({
      ...baseDoc,
      elements: [{ type: 'text', content: 'Hi', options: { x: 1, y: 2 } }],
    });

    expect(output).toContain('A1,2,0,2,1,1,N,"Hi"');
  });

  it('cảnh báo từng loại element EPL2 không có lệnh, mỗi loại 1 lần', () => {
    const { warnings } = new EplCompiler().compile({
      ...baseDoc,
      elements: [
        { type: 'diagonal', options: { x1: 0, y1: 0, x2: 10, y2: 10 } },
        { type: 'circle', options: { x: 0, y: 0, diameter: 20 } },
        { type: 'circle', options: { x: 5, y: 5, diameter: 20 } },
        { type: 'ellipse', options: { x: 0, y: 0, width: 20, height: 10 } },
        { type: 'reverse', options: { x: 0, y: 0, width: 20, height: 10 } },
        { type: 'erase', options: { x: 0, y: 0, width: 20, height: 10 } },
        { type: 'cut', options: { mode: 'full' } },
      ],
    });

    expect(warnings).toEqual(
      ['diagonal', 'circle', 'ellipse', 'reverse', 'erase', 'cut'].map(
        (type) => `Element "${type}" bị bỏ qua — EPL không có lệnh tương ứng.`,
      ),
    );
  });

  it('element được hỗ trợ thì không có cảnh báo', () => {
    const { warnings } = new EplCompiler().compile({
      ...baseDoc,
      elements: [
        { type: 'text', content: 'Hi', options: { fontSize: 24 } },
        { type: 'box', options: { x: 0, y: 0, width: 10, height: 10 } },
      ],
    });

    expect(warnings).toEqual([]);
  });

  it('cut tắt (mode off) không cần lệnh cắt nên không cảnh báo', () => {
    const { warnings } = new EplCompiler().compile({
      ...baseDoc,
      elements: [{ type: 'cut', options: { mode: 'off' } }],
    });

    expect(warnings).toEqual([]);
  });
});
